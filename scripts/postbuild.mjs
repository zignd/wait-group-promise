import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cjsPath = fileURLToPath(new URL('../dist/index.cjs', import.meta.url));
const esmDeclarationPath = fileURLToPath(new URL('../dist/index.d.ts', import.meta.url));
const cjsDeclarationPath = fileURLToPath(new URL('../dist/index.d.cts', import.meta.url));

const sourceMapMarker = '//# sourceMappingURL=';
const interopMarker = '// CommonJS interoperability:';

const interop = `${interopMarker} make \`require("wait-group-promise")\` return the
// WaitGroup class while keeping named exports available as properties.
if (module.exports.default) {
  module.exports = Object.assign(module.exports.default, module.exports);
}
`;

function addCommonJsInterop() {
  const code = readFileSync(cjsPath, 'utf8');

  if (code.includes(interopMarker)) {
    return;
  }

  const markerIndex = code.lastIndexOf(sourceMapMarker);

  if (markerIndex === -1) {
    writeFileSync(cjsPath, `${code}\n${interop}`);
  } else {
    writeFileSync(cjsPath, `${code.slice(0, markerIndex)}${interop}${code.slice(markerIndex)}`);
  }
}

function writeCommonJsDeclaration() {
  const declaration = readFileSync(esmDeclarationPath, 'utf8');

  if (!/^type WaitGroupErrorCode = /m.test(declaration)) {
    throw new Error('Could not find WaitGroupErrorCode in the generated declarations.');
  }

  const exportStart = declaration.lastIndexOf('\nexport {');

  if (exportStart === -1) {
    throw new Error('Could not find the export block in the generated declarations.');
  }

  // `require()` returns the class itself, so the declaration must use
  // `export =`. Namespace members keep named imports usable as values and types.
  const declarations = declaration
    .slice(0, exportStart)
    .trimEnd()
    .replace(/^type WaitGroupErrorCode/m, 'export type WaitGroupErrorCode')
    .replace(/\bdeclare class /g, 'export class ');

  const indentedDeclarations = declarations
    .split('\n')
    .map((line) => (line.length > 0 ? `  ${line}` : line))
    .join('\n');

  const cjsDeclaration = `declare namespace WaitGroupImpl {
${indentedDeclarations}
}

declare class WaitGroupExport extends WaitGroupImpl.WaitGroup {
  static readonly default: typeof WaitGroupImpl.WaitGroup;
}

declare namespace WaitGroupExport {
  export import WaitGroup = WaitGroupImpl.WaitGroup;
  export import WaitGroupError = WaitGroupImpl.WaitGroupError;
  export import WaitGroupStateError = WaitGroupImpl.WaitGroupStateError;
  export import WaitGroupTimeoutError = WaitGroupImpl.WaitGroupTimeoutError;
  export type WaitGroupErrorCode = WaitGroupImpl.WaitGroupErrorCode;
}

export = WaitGroupExport;
`;

  writeFileSync(cjsDeclarationPath, cjsDeclaration);
}

addCommonJsInterop();
writeCommonJsDeclaration();
