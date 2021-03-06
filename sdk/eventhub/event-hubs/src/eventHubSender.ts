// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import uuid from "uuid/v4";
import { logger, logErrorStackTrace } from "./log";
import {
  AwaitableSender,
  EventContext,
  OnAmqpEvent,
  AwaitableSenderOptions,
  message,
  AmqpError
} from "rhea-promise";
import {
  defaultLock,
  retry,
  translate,
  AmqpMessage,
  ErrorNameConditionMapper,
  RetryConfig,
  RetryOperationType,
  RetryOptions,
  Constants
} from "@azure/core-amqp";
import { EventData, toAmqpMessage } from "./eventData";
import { ConnectionContext } from "./connectionContext";
import { LinkEntity } from "./linkEntity";
import {
  SendOptions,
  EventHubProducerOptions,
  getRetryAttemptTimeoutInMs
} from "./impl/eventHubClient";
import { AbortSignalLike, AbortError } from "@azure/abort-controller";
import { EventDataBatch, isEventDataBatch } from "./eventDataBatch";

/**
 * Describes the EventHubSender that will send event data to EventHub.
 * @class EventHubSender
 * @internal
 * @ignore
 */
export class EventHubSender extends LinkEntity {
  /**
   * @property senderLock The unqiue lock name per connection that is used to acquire the
   * lock for establishing a sender link by an entity on that connection.
   * @readonly
   */
  readonly senderLock: string = `sender-${uuid()}`;
  /**
   * @property _onAmqpError The handler function to handle errors that happen on the
   * underlying sender.
   * @readonly
   */
  private readonly _onAmqpError: OnAmqpEvent;
  /**
   * @property _onAmqpClose The handler function to handle "sender_close" event
   * that happens on the underlying sender.
   * @readonly
   */
  private readonly _onAmqpClose: OnAmqpEvent;
  /**
   * @property _onSessionError The message handler that will be set as the handler on
   * the underlying rhea sender's session for the "session_error" event.
   * @private
   */
  private _onSessionError: OnAmqpEvent;
  /**
   * @property _onSessionClose The message handler that will be set as the handler on
   * the underlying rhea sender's session for the "session_close" event.
   * @private
   */
  private _onSessionClose: OnAmqpEvent;
  /**
   * @property [_sender] The AMQP sender link.
   * @private
   */
  private _sender?: AwaitableSender;

  /**
   * Creates a new EventHubSender instance.
   * @ignore
   * @constructor
   * @param context The connection context.
   * @param [partitionId] The EventHub partition id to which the sender
   * wants to send the event data.
   */
  constructor(context: ConnectionContext, partitionId?: string) {
    super(context, {
      name: context.config.getSenderAddress(partitionId),
      partitionId: partitionId
    });
    this.address = context.config.getSenderAddress(partitionId);
    this.audience = context.config.getSenderAudience(partitionId);

    this._onAmqpError = (context: EventContext) => {
      const senderError = context.sender && context.sender.error;
      if (senderError) {
        const err = translate(senderError);
        logger.verbose(
          "[%s] An error occurred for sender '%s': %O.",
          this._context.connectionId,
          this.name,
          err
        );
      }
    };

    this._onSessionError = (context: EventContext) => {
      const sessionError = context.session && context.session.error;
      if (sessionError) {
        const err = translate(sessionError);
        logger.verbose(
          "[%s] An error occurred on the session of sender '%s': %O.",
          this._context.connectionId,
          this.name,
          err
        );
      }
    };

    this._onAmqpClose = async (context: EventContext) => {
      const sender = this._sender || context.sender!;
      const senderError = context.sender && context.sender.error;
      if (senderError) {
        logger.verbose(
          "[%s] 'sender_close' event occurred for sender '%s' with address '%s'. " +
            "The associated error is: %O",
          this._context.connectionId,
          this.name,
          this.address,
          senderError
        );
      }
      if (sender && !sender.isItselfClosed()) {
        if (!this.isConnecting) {
          logger.verbose(
            "[%s] 'sender_close' event occurred on the sender '%s' with address '%s' " +
              "and the sdk did not initiate this. The sender is not reconnecting. Hence, calling " +
              "detached from the _onAmqpClose() handler.",
            this._context.connectionId,
            this.name,
            this.address
          );
          await this.onDetached(senderError);
        } else {
          logger.verbose(
            "[%s] 'sender_close' event occurred on the sender '%s' with address '%s' " +
              "and the sdk did not initate this. Moreover the sender is already re-connecting. " +
              "Hence not calling detached from the _onAmqpClose() handler.",
            this._context.connectionId,
            this.name,
            this.address
          );
        }
      } else {
        logger.verbose(
          "[%s] 'sender_close' event occurred on the sender '%s' with address '%s' " +
            "because the sdk initiated it. Hence not calling detached from the _onAmqpClose" +
            "() handler.",
          this._context.connectionId,
          this.name,
          this.address
        );
      }
    };

    this._onSessionClose = async (context: EventContext) => {
      const sender = this._sender || context.sender!;
      const sessionError = context.session && context.session.error;
      if (sessionError) {
        logger.verbose(
          "[%s] 'session_close' event occurred for sender '%s' with address '%s'. " +
            "The associated error is: %O",
          this._context.connectionId,
          this.name,
          this.address,
          sessionError
        );
      }
      if (sender && !sender.isSessionItselfClosed()) {
        if (!this.isConnecting) {
          logger.verbose(
            "[%s] 'session_close' event occurred on the session of sender '%s' with " +
              "address '%s' and the sdk did not initiate this. Hence calling detached from the " +
              "_onSessionClose() handler.",
            this._context.connectionId,
            this.name,
            this.address
          );
          await this.onDetached(sessionError);
        } else {
          logger.verbose(
            "[%s] 'session_close' event occurred on the session of sender '%s' with " +
              "address '%s' and the sdk did not initiate this. Moreover the sender is already " +
              "re-connecting. Hence not calling detached from the _onSessionClose() handler.",
            this._context.connectionId,
            this.name,
            this.address
          );
        }
      } else {
        logger.verbose(
          "[%s] 'session_close' event occurred on the session of sender '%s' with address " +
            "'%s' because the sdk initiated it. Hence not calling detached from the _onSessionClose" +
            "() handler.",
          this._context.connectionId,
          this.name,
          this.address
        );
      }
    };
  }

  /**
   * Will reconnect the sender link if necessary.
   * @ignore
   * @param [senderError] The sender error if any.
   * @returns Promise<void>.
   */
  async onDetached(senderError?: AmqpError | Error): Promise<void> {
    try {
      const wasCloseInitiated = this._sender && this._sender.isItselfClosed();
      // Clears the token renewal timer. Closes the link and its session if they are open.
      // Removes the link and its session if they are present in rhea's cache.
      await this._closeLink(this._sender);
      // We should attempt to reopen only when the sender(sdk) did not initiate the close
      let shouldReopen = false;
      if (senderError && !wasCloseInitiated) {
        const translatedError = translate(senderError);
        if (translatedError.retryable) {
          shouldReopen = true;
          logger.verbose(
            "[%s] close() method of Sender '%s' with address '%s' was not called. There " +
              "was an accompanying error an it is retryable. This is a candidate for re-establishing " +
              "the sender link.",
            this._context.connectionId,
            this.name,
            this.address
          );
        } else {
          logger.verbose(
            "[%s] close() method of Sender '%s' with address '%s' was not called. There " +
              "was an accompanying error and it is NOT retryable. Hence NOT re-establishing " +
              "the sender link.",
            this._context.connectionId,
            this.name,
            this.address
          );
        }
      } else if (!wasCloseInitiated) {
        shouldReopen = true;
        logger.verbose(
          "[%s] close() method of Sender '%s' with address '%s' was not called. There " +
            "was no accompanying error as well. This is a candidate for re-establishing " +
            "the sender link.",
          this._context.connectionId,
          this.name,
          this.address
        );
      } else {
        const state: any = {
          wasCloseInitiated: wasCloseInitiated,
          senderError: senderError,
          _sender: this._sender
        };
        logger.verbose(
          "[%s] Something went wrong. State of sender '%s' with address '%s' is: %O",
          this._context.connectionId,
          this.name,
          this.address,
          state
        );
      }
      if (shouldReopen) {
        await defaultLock.acquire(this.senderLock, () => {
          const options: AwaitableSenderOptions = this._createSenderOptions(
            Constants.defaultOperationTimeoutInMs,
            true
          );
          // shall retry forever at an interval of 15 seconds if the error is a retryable error
          // else bail out when the error is not retryable or the oepration succeeds.
          const config: RetryConfig<void> = {
            operation: () => this._init(options),
            connectionId: this._context.connectionId,
            operationType: RetryOperationType.senderLink,
            connectionHost: this._context.config.host,
            retryOptions: {
              maxRetries: Constants.defaultMaxRetriesForConnection,
              retryDelayInMs: 15000
            }
          };
          return retry<void>(config);
        });
      }
    } catch (err) {
      logger.verbose(
        "[%s] An error occurred while processing onDetached() of Sender '%s' with address " +
          "'%s': %O",
        this._context.connectionId,
        this.name,
        this.address,
        err
      );
    }
  }

  /**
   * Deletes the sender fromt the context. Clears the token renewal timer. Closes the sender link.
   * @ignore
   * @returns Promise<void>
   */
  async close(): Promise<void> {
    if (this._sender) {
      logger.info(
        "[%s] Closing the Sender for the entity '%s'.",
        this._context.connectionId,
        this._context.config.entityPath
      );
      const senderLink = this._sender;
      this._deleteFromCache();
      await this._closeLink(senderLink);
    }
  }

  /**
   * Determines whether the AMQP sender link is open. If open then returns true else returns false.
   * @ignore
   * @returns boolean
   */
  isOpen(): boolean {
    const result: boolean = this._sender! && this._sender!.isOpen();
    logger.verbose(
      "[%s] Sender '%s' with address '%s' is open? -> %s",
      this._context.connectionId,
      this.name,
      this.address,
      result
    );
    return result;
  }
  /**
   * Returns maximum message size on the AMQP sender link.
   * @param abortSignal An implementation of the `AbortSignalLike` interface to signal the request to cancel the operation.
   * For example, use the &commat;azure/abort-controller to create an `AbortSignal`.
   * @returns Promise<number>
   * @throws {AbortError} Thrown if the operation is cancelled via the abortSignal.
   */
  async getMaxMessageSize(
    options: {
      retryOptions?: RetryOptions;
      abortSignal?: AbortSignalLike;
    } = {}
  ): Promise<number> {
    const abortSignal = options.abortSignal;
    const retryOptions = options.retryOptions || {};
    if (this.isOpen()) {
      return this._sender!.maxMessageSize;
    }
    return new Promise<number>(async (resolve, reject) => {
      const rejectOnAbort = () => {
        const desc: string = `[${this._context.connectionId}] The create batch operation has been cancelled by the user.`;
        // Cancellation is user-intented, so treat as info instead of warning.
        logger.info(desc);
        const error = new AbortError(`The create batch operation has been cancelled by the user.`);
        reject(error);
      };

      const onAbort = () => {
        if (abortSignal) {
          abortSignal.removeEventListener("abort", onAbort);
        }
        rejectOnAbort();
      };

      if (abortSignal) {
        // the aborter may have been triggered between request attempts
        // so check if it was triggered and reject if needed.
        if (abortSignal.aborted) {
          return rejectOnAbort();
        }
        abortSignal.addEventListener("abort", onAbort);
      }
      try {
        logger.verbose(
          "Acquiring lock %s for initializing the session, sender and " +
            "possibly the connection.",
          this.senderLock
        );
        const senderOptions = this._createSenderOptions(Constants.defaultOperationTimeoutInMs);
        await defaultLock.acquire(this.senderLock, () => {
          const config: RetryConfig<void> = {
            operation: () => this._init(senderOptions),
            connectionId: this._context.connectionId,
            operationType: RetryOperationType.senderLink,
            abortSignal: abortSignal,
            retryOptions: retryOptions
          };

          return retry<void>(config);
        });
        resolve(this._sender!.maxMessageSize);
      } catch (err) {
        logger.warning(
          "[%s] An error occurred while creating the sender %s",
          this._context.connectionId,
          this.name
        );
        logErrorStackTrace(err);
        reject(err);
      } finally {
        if (abortSignal) {
          abortSignal.removeEventListener("abort", onAbort);
        }
      }
    });
  }

  /**
   * Send a batch of EventData to the EventHub. The "message_annotations",
   * "application_properties" and "properties" of the first message will be set as that
   * of the envelope (batch message).
   * @ignore
   * @param events  An array of EventData objects to be sent in a Batch message.
   * @param options Options to control the way the events are batched along with request options
   * @return Promise<void>
   */
  async send(
    events: EventData[] | EventDataBatch,
    options?: SendOptions & EventHubProducerOptions
  ): Promise<void> {
    try {
      // throw an error if partition key and partition id are both defined
      if (
        options &&
        typeof options.partitionKey === "string" &&
        typeof options.partitionId === "string"
      ) {
        const error = new Error(
          "Partition key is not supported when using producers that were created using a partition id."
        );
        logger.warning(
          "[%s] Partition key is not supported when using producers that were created using a partition id. %O",
          this._context.connectionId,
          error
        );
        logErrorStackTrace(error);
        throw error;
      }

      // throw an error if partition key is different than the one provided in the options.
      if (isEventDataBatch(events) && options && options.partitionKey) {
        const error = new Error(
          "Partition key is not supported when sending a batch message. Pass the partition key when creating the batch message instead."
        );
        logger.warning(
          "[%s] Partition key is not supported when sending a batch message. Pass the partition key when creating the batch message instead. %O",
          this._context.connectionId,
          error
        );
        logErrorStackTrace(error);
        throw error;
      }

      logger.info(
        "[%s] Sender '%s', trying to send EventData[].",
        this._context.connectionId,
        this.name
      );

      let encodedBatchMessage: Buffer | undefined;
      if (isEventDataBatch(events)) {
        encodedBatchMessage = events._message!;
      } else {
        const partitionKey = (options && options.partitionKey) || undefined;
        const messages: AmqpMessage[] = [];
        // Convert EventData to AmqpMessage.
        for (let i = 0; i < events.length; i++) {
          const message = toAmqpMessage(events[i], partitionKey);
          message.body = this._context.dataTransformer.encode(events[i].body);
          messages[i] = message;
        }
        // Encode every amqp message and then convert every encoded message to amqp data section
        const batchMessage: AmqpMessage = {
          body: message.data_sections(messages.map(message.encode))
        };

        // Set message_annotations of the first message as
        // that of the envelope (batch message).
        if (messages[0].message_annotations) {
          batchMessage.message_annotations = messages[0].message_annotations;
        }

        // Finally encode the envelope (batch message).
        encodedBatchMessage = message.encode(batchMessage);
      }
      logger.info(
        "[%s] Sender '%s', sending encoded batch message.",
        this._context.connectionId,
        this.name,
        encodedBatchMessage
      );
      return await this._trySendBatch(encodedBatchMessage, options);
    } catch (err) {
      logger.warning("An error occurred while sending the batch message %O", err);
      logErrorStackTrace(err);
      throw err;
    }
  }

  private _deleteFromCache(): void {
    this._sender = undefined;
    delete this._context.senders[this.name];
    logger.verbose(
      "[%s] Deleted the sender '%s' with address '%s' from the client cache.",
      this._context.connectionId,
      this.name,
      this.address
    );
  }

  private _createSenderOptions(timeoutInMs: number, newName?: boolean): AwaitableSenderOptions {
    if (newName) this.name = `${uuid()}`;
    const srOptions: AwaitableSenderOptions = {
      name: this.name,
      target: {
        address: this.address
      },
      onError: this._onAmqpError,
      onClose: this._onAmqpClose,
      onSessionError: this._onSessionError,
      onSessionClose: this._onSessionClose,
      sendTimeoutInSeconds: timeoutInMs / 1000
    };
    logger.verbose("Creating sender with options: %O", srOptions);
    return srOptions;
  }

  /**
   * Tries to send the message to EventHub if there is enough credit to send them
   * and the circular buffer has available space to settle the message after sending them.
   *
   * We have implemented a synchronous send over here in the sense that we shall be waiting
   * for the message to be accepted or rejected and accordingly resolve or reject the promise.
   * @ignore
   * @param message The message to be sent to EventHub.
   * @returns Promise<void>
   */
  private _trySendBatch(
    message: AmqpMessage | Buffer,
    options: SendOptions & EventHubProducerOptions = {}
  ): Promise<void> {
    const abortSignal: AbortSignalLike | undefined = options.abortSignal;
    const retryOptions = options.retryOptions || {};
    const sendEventPromise = () =>
      new Promise<void>(async (resolve, reject) => {
        const rejectOnAbort = () => {
          const desc: string =
            `[${this._context.connectionId}] The send operation on the Sender "${this.name}" with ` +
            `address "${this.address}" has been cancelled by the user.`;
          // Cancellation is user-intended, so log to info instead of warning.
          logger.info(desc);
          return reject(new AbortError("The send operation has been cancelled by the user."));
        };

        if (abortSignal && abortSignal.aborted) {
          // operation has been cancelled, so exit quickly
          return rejectOnAbort();
        }

        const removeListeners = (): void => {
          clearTimeout(waitTimer);
          if (abortSignal) {
            abortSignal.removeEventListener("abort", onAborted);
          }
        };

        const onAborted = () => {
          removeListeners();
          return rejectOnAbort();
        };

        if (abortSignal) {
          abortSignal.addEventListener("abort", onAborted);
        }

        const actionAfterTimeout = () => {
          removeListeners();
          const desc: string =
            `[${this._context.connectionId}] Sender "${this.name}" with ` +
            `address "${this.address}", was not able to send the message right now, due ` +
            `to operation timeout.`;
          logger.warning(desc);
          const e: Error = {
            name: "OperationTimeoutError",
            message: desc
          };
          return reject(translate(e));
        };

        const waitTimer = setTimeout(
          actionAfterTimeout,
          getRetryAttemptTimeoutInMs(options.retryOptions)
        );

        if (!this.isOpen()) {
          logger.verbose(
            "Acquiring lock %s for initializing the session, sender and " +
              "possibly the connection.",
            this.senderLock
          );

          try {
            const senderOptions = this._createSenderOptions(
              getRetryAttemptTimeoutInMs(options.retryOptions)
            );
            await defaultLock.acquire(this.senderLock, () => {
              return this._init(senderOptions);
            });
          } catch (err) {
            removeListeners();
            err = translate(err);
            logger.warning(
              "[%s] An error occurred while creating the sender %s",
              this._context.connectionId,
              this.name,
              err
            );
            logErrorStackTrace(err);
            return reject(err);
          }
        }

        logger.verbose(
          "[%s] Sender '%s', credit: %d available: %d",
          this._context.connectionId,
          this.name,
          this._sender!.credit,
          this._sender!.session.outgoing.available()
        );
        if (this._sender!.sendable()) {
          logger.verbose(
            "[%s] Sender '%s', sending message with id '%s'.",
            this._context.connectionId,
            this.name
          );

          try {
            const delivery = await this._sender!.send(message, undefined, 0x80013700);
            logger.info(
              "[%s] Sender '%s', sent message with delivery id: %d",
              this._context.connectionId,
              this.name,
              delivery.id
            );
            return resolve();
          } catch (err) {
            err = translate(err.innerError || err);
            logger.warning(
              "[%s] An error occurred while sending the message",
              this._context.connectionId,
              err
            );
            logErrorStackTrace(err);
            return reject(err);
          } finally {
            removeListeners();
          }
        } else {
          // let us retry to send the message after some time.
          const msg =
            `[${this._context.connectionId}] Sender "${this.name}", ` +
            `cannot send the message right now. Please try later.`;
          logger.warning(msg);
          const amqpError: AmqpError = {
            condition: ErrorNameConditionMapper.SenderBusyError,
            description: msg
          };
          reject(translate(amqpError));
        }
      });

    const config: RetryConfig<void> = {
      operation: sendEventPromise,
      connectionId: this._context.connectionId,
      operationType: RetryOperationType.sendMessage,
      abortSignal: abortSignal,
      retryOptions: retryOptions
    };
    return retry<void>(config);
  }

  /**
   * Initializes the sender session on the connection.
   * @ignore
   * @returns
   */
  private async _init(options: AwaitableSenderOptions): Promise<void> {
    try {
      // isOpen isConnecting  Should establish
      // true     false          No
      // true     true           No
      // false    true           No
      // false    false          Yes
      if (!this.isOpen() && !this.isConnecting) {
        logger.verbose(
          "[%s] The sender '%s' with address '%s' is not open and is not currently " +
            "establishing itself. Hence let's try to connect.",
          this._context.connectionId,
          this.name,
          this.address
        );
        this.isConnecting = true;
        await this._negotiateClaim();
        logger.verbose(
          "[%s] Trying to create sender '%s'...",
          this._context.connectionId,
          this.name
        );

        this._sender = await this._context.connection.createAwaitableSender(options);
        this.isConnecting = false;
        logger.verbose(
          "[%s] Sender '%s' with address '%s' has established itself.",
          this._context.connectionId,
          this.name,
          this.address
        );
        this._sender.setMaxListeners(1000);
        logger.verbose(
          "[%s] Promise to create the sender resolved. Created sender with name: %s",
          this._context.connectionId,
          this.name
        );
        logger.verbose(
          "[%s] Sender '%s' created with sender options: %O",
          this._context.connectionId,
          this.name,
          options
        );
        // It is possible for someone to close the sender and then start it again.
        // Thus make sure that the sender is present in the client cache.
        if (!this._context.senders[this.name]) this._context.senders[this.name] = this;
        await this._ensureTokenRenewal();
      } else {
        logger.verbose(
          "[%s] The sender '%s' with address '%s' is open -> %s and is connecting " +
            "-> %s. Hence not reconnecting.",
          this._context.connectionId,
          this.name,
          this.address,
          this.isOpen(),
          this.isConnecting
        );
      }
    } catch (err) {
      this.isConnecting = false;
      err = translate(err);
      logger.warning(
        "[%s] An error occurred while creating the sender %s",
        this._context.connectionId,
        this.name,
        err
      );
      logErrorStackTrace(err);
      throw err;
    }
  }

  /**
   * Creates a new sender to the given event hub, and optionally to a given partition if it is
   * not present in the context or returns the one present in the context.
   * @ignore
   * @static
   * @param [partitionId] Partition ID to which it will send event data.
   * @returns
   */
  static create(context: ConnectionContext, partitionId?: string): EventHubSender {
    const ehSender: EventHubSender = new EventHubSender(context, partitionId);
    if (!context.senders[ehSender.name]) {
      context.senders[ehSender.name] = ehSender;
    }
    return context.senders[ehSender.name];
  }
}
