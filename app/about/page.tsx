type TestItem = { data: string; test?: string };

const URL = process.env.NEXT_PUBLIC_VERCEL_URL
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}/api/test`
  : "http://localhost:3000/api/test";

export default async function About() {
  let data: TestItem[] = [];
  let error: string | null = null;

  try {
    const res = await fetch(URL, {
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `HTTP ${res.status} ${res.statusText} - ${text.slice(0, 200)}`
      );
    }

    const json = await res.json();

    // Normalize response to an array
    if (Array.isArray(json)) {
      data = json;
    } else if (json && typeof json === "object") {
      data = [json];
    } else {
      data = [];
    }
  } catch (err) {
    error = String(err);
  }

  return (
    <main>
      <h1>Msg from FastAPI Backend</h1>

      {error ? (
        <p style={{ color: "red" }}>Error fetching backend: {error}</p>
      ) : data.length === 0 ? (
        <p>No data</p>
      ) : (
        <ul>
          {data.map((item) => (
            <li key={item.data}>{item.test ?? item.data}</li>
          ))}
        </ul>
      )}
      <div>{URL}</div>
    </main>
  );
}
