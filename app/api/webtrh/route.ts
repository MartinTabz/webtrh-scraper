import axios from "axios";
import { headers } from "next/headers";
import * as cheerio from "cheerio";

export async function GET() {
	const headersList = await headers();
	const hasAccessKey = headersList.has("accesskey");

	if (!hasAccessKey) {
		return new Response("Chybí heslo", { status: 401 });
	}

	const accessKeyValue = headersList.get("accesskey");

	if (accessKeyValue != process.env.ACCESS_KEY) {
		return new Response("Heslo není správné", { status: 401 });
	}

	// Fetch Webtrh
	const { data: html } = await axios.get("https://webtrh.cz/poptavky/");
	const $ = cheerio.load(html);

	// Find latest inquiry
	const latestInquiryBox = $(".inquiry-box.unread").first();
	const title = latestInquiryBox.find(".title span").first().text().trim();
	console.log(title);
   
	// Compare it to the last saved in Supabase database
	// If it is the same = end
	// If its different, query the detail
	// Send the detail to OpenAI to return true or false if its relevant to me
	// If it is not = end
	// If it is = send notification to Pushover app on my iPhone

	return new Response("Vše v pořádku", { status: 200 });
}
