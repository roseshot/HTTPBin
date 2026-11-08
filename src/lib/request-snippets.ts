export const requestTools = [
  { id: "curl", label: "cURL" },
  { id: "httpie", label: "HTTPie" },
  { id: "fetch", label: "JavaScript Fetch" },
  { id: "python", label: "Python Requests" },
  { id: "pwsh", label: "PowerShell (pwsh)" },
] as const;

export type RequestTool = typeof requestTools[number]["id"];

export type SnippetRequest = {
  url: URL;
  method: string;
  headers: Headers;
  payload?: BodyInit;
  followRedirects: boolean;
};

function shellQuote(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

function powerShellQuote(value: string): string {
  return "'" + value.replace(/'/g, "''") + "'";
}

function powerShellFields(entries: [string, string][]): string {
  const grouped = new Map<string, string[]>();
  for (const [name, value] of entries) {
    const values = grouped.get(name) ?? [];
    values.push(value);
    grouped.set(name, values);
  }
  return "@{ " + Array.from(grouped, ([name, values]) =>
    powerShellQuote(name) + " = " + (values.length === 1 ? powerShellQuote(values[0]) :
      "@(" + values.map(powerShellQuote).join(", ") + ")"),
  ).join("; ") + " }";
}

function fields(payload: FormData): [string, string][] {
  return Array.from(payload.entries(), ([name, value]) => [name, String(value)]);
}

export function formatRequest(tool: RequestTool, request: SnippetRequest): string {
  const { url, method, headers, payload, followRedirects } = request;
  const pairs = [...headers.entries()];
  const body = typeof payload === "string" ? payload :
    payload instanceof URLSearchParams ? payload.toString() : null;

  if (tool === "curl") {
    const args = ["curl", "-i", "-X", method, shellQuote(url.href)];
    for (const [name, value] of pairs) args.push("-H", shellQuote(name + ": " + value));
    if (body !== null) args.push("--data-raw", shellQuote(body));
    if (payload instanceof FormData) {
      for (const [name, value] of fields(payload)) args.push("--form-string", shellQuote(name + "=" + value));
    }
    if (followRedirects) args.push("-L");
    return args.join(" ");
  }

  if (tool === "httpie") {
    const args = ["http", "--print=hb"];
    if (followRedirects) args.push("--follow");
    if (payload instanceof FormData) args.push("--form", "--multipart");
    args.push(method, shellQuote(url.href));
    for (const [name, value] of pairs) args.push(shellQuote(name + ":" + value));
    if (body !== null) args.push("--raw", shellQuote(body));
    if (payload instanceof FormData) {
      for (const [name, value] of fields(payload)) args.push(shellQuote(name + "=" + value));
    }
    return args.join(" ");
  }

  if (tool === "fetch") {
    const prefix: string[] = [];
    let bodyExpression: string | undefined;
    if (payload instanceof FormData) {
      prefix.push("const form = new FormData();");
      for (const [name, value] of fields(payload)) {
        prefix.push("form.append(" + JSON.stringify(name) + ", " + JSON.stringify(value) + ");");
      }
      bodyExpression = "form";
    } else if (payload instanceof URLSearchParams) {
      bodyExpression = "new URLSearchParams(" + JSON.stringify(payload.toString()) + ")";
    } else if (body !== null) {
      bodyExpression = JSON.stringify(body);
    }
    const init = [
      "method: " + JSON.stringify(method),
      "headers: " + JSON.stringify(Object.fromEntries(pairs), null, 2),
      "redirect: " + JSON.stringify(followRedirects ? "follow" : "manual"),
      ...(bodyExpression === undefined ? [] : ["body: " + bodyExpression]),
    ];
    return [...prefix, "const response = await fetch(" + JSON.stringify(url.href) + ", {", ...init.map((line) => "  " + line.replace(/\n/g, "\n  ") + ","), "});"].join("\n");
  }

  if (tool === "pwsh") {
    const args = [
      "Invoke-WebRequest",
      "-Uri", powerShellQuote(url.href),
      method === "QUERY" ? "-CustomMethod" : "-Method", powerShellQuote(method),
    ];
    if (pairs.length) args.push("-Headers", powerShellFields(pairs));
    if (payload instanceof FormData) args.push("-Form", powerShellFields(fields(payload)));
    else if (body !== null) args.push("-Body", powerShellQuote(body));
    if (!followRedirects) args.push("-MaximumRedirection", "0");
    args.push("-SkipHttpErrorCheck");
    return "$response = " + args.join(" ");
  }

  if (tool === "python") {
    const args = [
      JSON.stringify(method),
      JSON.stringify(url.href),
      "headers=" + JSON.stringify(Object.fromEntries(pairs)),
      "allow_redirects=" + (followRedirects ? "True" : "False"),
    ];
    if (payload instanceof FormData) {
      args.push("files=[" + fields(payload).map(([name, value]) =>
        "(" + JSON.stringify(name) + ", (None, " + JSON.stringify(value) + "))",
      ).join(", ") + "]");
    } else if (body !== null) {
      args.push("data=" + JSON.stringify(body));
    }
    return "import requests\n\nresponse = requests.request(" + args.join(", ") + ")";
  }

  throw new Error("Unsupported request tool.");
}
