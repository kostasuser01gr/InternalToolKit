
import { promises as fs } from 'fs';

export async function removeTestSkip(filePath: string) {
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const newContent = fileContent.replace(/test\.skip\(testInfo\.project\.name\.toLowerCase\(\) !== "desktop"\);/g, '');
    await fs.writeFile(filePath, newContent, 'utf-8');
    console.log(`Successfully removed test.skip from ${filePath}`);
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
  }
}
