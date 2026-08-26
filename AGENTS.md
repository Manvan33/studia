## Guidelines

- If coding in python, use `uv` to manage dependencies and run scripts.
- Create regular commits for each feature or fix, and provide clear commit messages.
  For each commit, add an entry in `CHANGELOG.md` with the commit message and a brief description of the changes made.
- Everytime you struggle on a problem, document it in `FINDINGS.md` with a description of the problem, your thought process, and the solution you found.
  Reuse FINDINGS to avoid solving the same problem multiple times.
- Follow the SPECS.md file for feature requirements, and refer to it often to ensure you're meeting all criteria.

## Available MCP Tools:

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
