async function getGdacs() {
  const url = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=ALL";
  console.log("Fetching", url);
  const res = await fetch(url);
  console.log(res.status, res.headers.get("content-type"));
  const text = await res.text();
  console.log(text.substring(0, 100));
}
getGdacs().catch(console.error);
