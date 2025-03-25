import { headers } from "next/headers";

export async function GET(req: Request) {
	const headersList = await headers();
	const hasAccessKey = headersList.has("accesskey");

	if (!hasAccessKey) {
		return new Response("Chybí heslo", { status: 401 });
	}

	const accessKeyValue = headersList.get("accesskey");

	if (accessKeyValue != process.env.ACCESS_KEY) {
		return new Response("Heslo není správné", { status: 401 });
	}

	return new Response("Vše v pořádku", { status: 200 });
}
