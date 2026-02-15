import * as marked from "marked";

export async function processMarkdown(data: string): Promise<string|undefined> {
  try {
    const output = await marked.parse(data, {
      gfm: true,
      breaks: true,
      pedantic: false,
      silent: false,
      async: true
    });
    return output 
  } catch (error) {
    console.error('Error processing markdown:', error);
   // return data; // Return original text if processing fails
  }
}
