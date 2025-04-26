import axios from "axios";
import * as cheerio from "cheerio";
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const openAIClient = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

const redis = Redis.fromEnv();

export async function GET(request: NextRequest) {
	const authHeader = request.headers.get("authorization");
	if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
		return new NextResponse("Unauthorized", {
			status: 401,
		});
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
		return new NextResponse("Něco se pokazilo při fetchování stránky Webtrhu", {
			status: 500,
		});
	}

	// Compare it to the last saved in KV
	// If it is the same = end
	const result = await redis.get("previous");
	if (result == latestInquiry) {
		return new NextResponse("Vše v pořádku", { status: 200 });
	}

	await redis.set("previous", latestInquiry);

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

	console.log(
		"Odpověď AI na to jestli je to relevantní, nebo ne: ",
		isRelevant
	);

	// If it is not = end
	if (isRelevant != "true") {
		return new NextResponse("Vše v pořádku", { status: 200 });
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
			return new NextResponse("Vše v pořádku", { status: 200 });
		} else {
			return new NextResponse(
				"Něco se pokazilo při odesílání upozornění do telefonu",
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error(error);
		return new NextResponse(
			"Něco se pokazilo při odesílání upozornění do telefonu",
			{ status: 500 }
		);
	}
}
