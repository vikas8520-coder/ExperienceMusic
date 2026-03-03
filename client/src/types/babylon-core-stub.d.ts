// Temporary offline stub so Babylon migration files type-check without network-installed deps.
// Replace by installing "@babylonjs/core" and then remove this stub.
declare module "@babylonjs/core" {
  const BABYLON: any;
  export = BABYLON;
}
