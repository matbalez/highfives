import { lookupPaymentInstructions } from "./dns-util";

// Sample btag to test
const testBtag = "john@example.com";

async function main() {
  console.log(`Testing payment instruction lookup for btag: ${testBtag}`);
  
  try {
    const result = await lookupPaymentInstructions(testBtag);
    console.log("Result:", result);
  } catch (error) {
    console.error("Error:", error);
  }
}

main().catch(console.error);