// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/*
  If you use BlobClient.download() to download an append blob which is being actively appended,
  you may get a 412 HTTP error, just like this issue: https://github.com/Azure/azure-storage-js/issues/51

  Recommend solution is to snapshot the append blob, and read from the snapshot blob.

  Reason
  - blobClient.download() will try to download a blob with a HTTP Get request into a stream.
  - When a stream unexpectedly ends because of an unreliable network, retry will resume the stream read
    from that broken point with a new HTTP Get request.
  - The second HTTP request will use conditional header `IfMatch` with the blob's `ETag`
    returned in first request to make sure the blob doesn't change when the 2nd retry happens.
    Otherwise, a 412 conditional header doesn't match error will be returned.
  - This strict strategy is used to avoid data integrity issues, such as the blob maybe totally over written by someone others.
    However, this strategy seems avoiding reading from reading a constantly updated log file when a retry happens.


  Setup: Enter your storage account name and shared key in main()
*/

import { ContainerClient, StorageSharedKeyCredential } from "@azure/storage-blob";

// Load the .env file if it exists
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

export async function main() {
  // Enter your storage account name and shared key
  const account = process.env.ACCOUNT_NAME || "";
  const accountKey = process.env.ACCOUNT_KEY || "";

  // Use StorageSharedKeyCredential with storage account and account key
  // StorageSharedKeyCredential is only avaiable in Node.js runtime, not in browsers
  const sharedKeyCredential = new StorageSharedKeyCredential(account, accountKey);

  // Create a container
  const containerName = `newcontainer${new Date().getTime()}`;
  const containerClient = new ContainerClient(
    `https://${account}.blob.core.windows.net/${containerName}`,
    sharedKeyCredential
  );

  const createContainerResponse = await containerClient.create();
  console.log(`Create container ${containerName} successfully`, createContainerResponse.requestId);

  // Create a blob
  const content = "hello";
  const blobName = "newblob" + new Date().getTime();
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  const uploadBlobResponse = await blockBlobClient.upload(content, content.length);
  console.log(`Uploaded block blob ${blobName} successfully`, uploadBlobResponse.requestId);

  // Downloading blob from the snapshot
  console.log("Downloading blob...");
  const snapshotResponse = await blockBlobClient.createSnapshot();
  const blobSnapshotClient = blockBlobClient.withSnapshot(snapshotResponse.snapshot!);

  const response = await blobSnapshotClient.download(0);
  console.log(
    "Reading response to string...",
    (await blobSnapshotClient.getProperties()).contentLength
  );

  console.log("Downloaded blob content", await streamToString(response.readableStreamBody!));

  // Delete container
  await containerClient.delete();

  console.log("deleted container");
}

// A helper method used to read a Node.js readable stream into string
async function streamToString(readableStream: NodeJS.ReadableStream) {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    readableStream.on("data", (data) => {
      chunks.push(data.toString());
    });
    readableStream.on("end", () => {
      resolve(chunks.join(""));
    });
    readableStream.on("error", reject);
  });
}

main().catch((err) => {
  console.error("Error running sample:", err.message);
});
