import { File } from "expo-file-system";

export async function chooseImportCsv(): Promise<string | null> {
  const selection = await File.pickFileAsync(undefined, "text/*");
  const file = Array.isArray(selection) ? selection[0] : selection;
  return file ? file.text() : null;
}
