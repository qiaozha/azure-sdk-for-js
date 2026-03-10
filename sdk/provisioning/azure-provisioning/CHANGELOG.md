# Release History

## 1.0.0-beta.1 (2026-03-10)

### Features Added

- Initial beta release of `@azure/provisioning`.
- `Infrastructure` class for collecting parameters, resources, and outputs and compiling them into a Bicep template string.
- `ProvisioningParameter` for declaring Bicep `param` declarations with optional descriptions, defaults, and secure flag.
- `ProvisioningOutput` for declaring Bicep `output` declarations.
- Abstract `ProvisionableResource` base class for all Azure resource types.
- Bicep expression types: `RawExpression`, `ResourcePropertyReference`, `ParameterReference`, `BicepInterpolation`.
- `bicepString` tagged template literal for Bicep string interpolation.
- Helper functions: `resourceGroup()`, `tenant()`, `uniqueString()`, `take()`, `concat()`, `literal()`, `toLower()`, `newGuid()`, `subscription()`.
- `Infrastructure.withDefaultLocation()` factory that pre-seeds the standard `location` parameter.
