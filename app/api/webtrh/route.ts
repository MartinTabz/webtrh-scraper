import axios from "axios";
import { headers } from "next/headers";
import * as cheerio from "cheerio";
import { getSupabase } from "@/utils/supabase";

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

	let latestInquiry: string = "";

	try {
		// Fetch Webtrh
		const { data: html } = await axios.get("https://webtrh.cz/poptavky/");
		const $ = cheerio.load(html);

		// Find latest inquiry
		const latestInquiryBox = $(".inquiry-box.unread").first();
		const title = latestInquiryBox.find(".title span").first().text().trim();

		latestInquiry = title;
	} catch (error) {
		console.error(error);
		return new Response("Něco se pokazilo při fetchování stránky Webtrhu", {
			status: 500,
		});
	}

	// Compare it to the last saved in Supabase database
	const supabase = getSupabase();
	const { data: dbData, error: dbErr } = await supabase
		.from("values")
		.select("value")
		.eq("name", "webtrh")
		.single();

	if (dbErr || !dbData) {
		return new Response("Nepodařilo se najít poslední poptávku", {
			status: 404,
		});
	}

	// If it is the same = end
	if (dbData.value == latestInquiry) {
		return new Response("Vše v pořádku", { status: 200 });
	}

	// Send the detail to OpenAI to return true or false if its relevant to me
	// If it is not = end
	// If it is = send notification to Pushover app on my iPhone

	return new Response("Vše v pořádku", { status: 200 });
}
