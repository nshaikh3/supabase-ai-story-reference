import ts from "typescript";

// Format the CLI's actual output with the pinned compiler; never hand-maintain types.
export function formatDatabaseTypes(output) {
  if (!output.includes("export type Database") || !/(?:stories|"stories")\s*:/.test(output)) throw new Error("Type generator returned unexpected output; existing types preserved.");
  const diagnostics = ts.transpileModule(output, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).diagnostics ?? [];
  if (diagnostics.some(item => item.category === ts.DiagnosticCategory.Error)) throw new Error("Generated database types contain invalid syntax; existing types preserved.");
  const source = ts.createSourceFile("database.ts", output, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  return ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(source);
}
