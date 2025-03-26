import axios from "axios";
import { headers } from "next/headers";
import * as cheerio from "cheerio";
import { getSupabase } from "@/utils/supabase";
import OpenAI from "openai";

const openAIClient = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

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

	const { error: dbUpdateErr } = await supabase
		.from("values")
		.update({ value: latestInquiry })
		.eq("name", "webtrh");

	if (dbUpdateErr) {
		console.error(dbUpdateErr);
		return new Response(
			"Něco se pokazilo při ukládání nejnovější poptávky do databáze",
			{
				status: 404,
			}
		);
	}

	// Send the detail to OpenAI to return true or false if its relevant to me
	const completion = await openAIClient.chat.completions.create({
		model: "gpt-4o-mini-2024-07-18",
		messages: [
			{
				role: "user",
				content: `Tvým úkolem bude rozpoznat, jestli název poptávky na freelance stránce je relevantní pro mne, a jestli bych tuto zakázku mohl plnit, nebo ne. Můj popis: Jsem programátor webových stránek (také jako webu) a webových aplikací. Pracuji pouze s NextJS a nepoužívám Wordpress. Jsem full-stack, takže dělám i webdesign. Vyznám se také v technických detailech ohledně webů, domén a podobně. Pokud se v názvu jedná o WordPress, tak pokud je to vytvoření nového webu, tak je to relevantní, ale pokud je to úprava, tak ne. Pokud se jedná o úpravu nějakého webu, tak je to relevantní. Také umím tvořit e-shopy - programovat, nebo přes Shopify a Shoptet. Tvůj práh bude nízko, takže i zakázky, kde není kontext, nebo bych je alespoň trochu mohl plnit označuj relevantní. Tvoje odpověď bude jednoslovná, buďto vrátíš true, nebo false, nic víc nepiš. Název poptávky je: ${latestInquiry}`,
			},
		],
	});

	const isRelevant = completion.choices[0].message.content;

	console.log(isRelevant);

	// If it is not = end
	if (isRelevant != "true") {
		return new Response("Vše v pořádku", { status: 200 });
	}

	// If it is = send notification to Pushover app on my iPhone
	const params = new URLSearchParams();
	params.append("token", process.env.PUSHOVER_TOKEN!);
	params.append("user", process.env.PUSHOVER_USER!);
	params.append("message", `Někdo poptává: ${latestInquiry}`);
	params.append("title", "Nová poptávka na WebTrhu!");

	try {
		const response = await axios.post(
			"https://api.pushover.net/1/messages.json",
			params,
			{
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
			}
		);
		if (response.status == 200) {
			return new Response("Vše v pořádku", { status: 200 });
		} else {
			return new Response(
				"Něco se pokazilo při odesílání upozornění do telefonu",
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error(error);
		return new Response(
			"Něco se pokazilo při odesílání upozornění do telefonu",
			{ status: 500 }
		);
	}
}
