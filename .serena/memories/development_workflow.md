# Development Workflow & Task Completion Requirements

## CRITICAL Workflow Rules

**After EVERY code change, you MUST run:**
1. `npm test` - Ensure all 470+ tests pass
2. `npm run lint` - Verify code quality

**Never proceed without both passing. No exceptions for "small changes".**

## Development Process
1. Check existing patterns in similar components/services
2. Use singleton instances: `StorageManager.getInstance()`, `PromptManager.getInstance()`
3. Follow TypeScript strict mode requirements
4. Add tests for new functionality
5. Run quality checks before committing

## Code Change Checklist
- [ ] Tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Chrome extension loads without errors
- [ ] Feature works on target AI platforms

## Git Workflow
```bash
git checkout -b feature/your-feature-name
# Make changes
npm test && npm run lint && npm run build
git commit -m "feat: add new feature"
git push origin feature/your-feature-name
```

## Testing Requirements
- Unit tests for all new services/utilities
- Component tests with React Testing Library
- Integration tests for storage operations
- Platform-specific tests for content scripts
- Manual testing on actual AI platforms

## Performance Considerations
- Monitor bundle size with `npm run build`
- Check memory usage in Chrome DevTools
- Verify content script performance on target sites
- Test with large prompt libraries (100+ prompts)