---
description: Scout requirements, plan architecture with validation, document in Confluence, create Jira tasks, and build implementation with agile tracking
argument-hint: <feature-name> [options]
allowed-tools: Editor, CreateFile, RunCommand, Browser, MCP, Bash
model: claude-sonnet-4-5-20250929
---

Please plan and build the requested feature: **$ARGUMENTS**.

Follow these steps:

1. **Explore & Research** – Read all relevant source files, requirements, or Confluence pages for this feature (ask to open specific files or search documentation). **Do NOT write any code yet.** Gather context and clarify any uncertainties (you may use sub-agents or code search for detailed checks).

2. **Plan the Implementation** – **think hard** to devise a clear step-by-step plan to solve the problem. Break the work into manageable tasks or components. Ensure the plan addresses the requirements and potential edge cases. When the plan is ready, **create a Confluence page** (via the Confluence integration) titled “Plan – $ARGUMENTS” (or an appropriate title) and paste the full plan there for reference.

3. **Create Jira Epic & Tasks** – Using the Jira integration, create a new **Epic** (if the feature is large enough) or a main Story representing this feature in the appropriate project. Then create individual **Jira issues** (stories or tasks) for each major step of the plan, with clear descriptions and acceptance criteria. Link each issue to the Epic (or label them accordingly). Ensure all new issues are in the backlog/to-do column upon creation.

4. **Pause for Confirmation** – Present the completed plan (and list of Jira issues) to the user for review. Ask: *“Do you approve this plan and want to proceed with implementation? (yes/no)”*. **Wait for the user to respond "yes"** before continuing to the next steps. If the user declines, gracefully stop the process and offer to adjust the plan if needed.

5. **Implement Tasks Sequentially (On Approval)** – **For each Jira task** created in Step 3, do the following:
   - Transition the Jira issue to **In Progress** (using the Jira MCP tools, e.g., move it to the next board column).
   - Write the code to implement the task in the codebase (following project conventions and using TypeScript best practices). Ensure you only implement the scope of that task.
   - Run the project’s test and build checks: execute `npm run test`, `npm run lint`, and `npm run typecheck` (and any other relevant build or test commands). Verify that all tests pass and there are no lint or type errors.
   - If tests pass, transition the Jira issue to **Done** (close it on the board). If tests or lints fail, fix the code and re-run the checks until the task passes all quality gates.
   - Continue to the next task issue and repeat this sub-step process until **all planned tasks are completed**.

6. **Commit & Finalize** – After implementing all tasks:
   - **Commit** the code changes to git with a descriptive commit message (include the Jira issue keys in the message for traceability, if applicable).
   - **Push and open a Pull Request** with the new changes. In the PR description, include a brief summary and link to the Confluence plan page and the Jira Epic (for context).
   - Update any relevant documentation or README if needed to reflect the new feature (you can add a comment on the Confluence plan page summarizing any deviations or notes during implementation).
   - Consider also posting a comment on the Jira Epic or Story with a link to the PR and the Confluence page for transparency.

**Note:** All interactions with Confluence and Jira should be done via the Atlassian MCP integration (Claude will perform them as instructed in natural language). ALWAYS ASK ON WITCH CONFLUENCE SPACE AND JIRA PROJECT TO DO THE ACTION. This ensures the plan and tasks are recorded in our Atlassian workspace. Throughout the process, adhere to coding standards and verify each step’s correctness before moving on. By following this workflow, Claude will effectively **explore, plan, code, and commit** the feature with minimal manual intervention, while keeping our documentation and task tracking in sync. 
