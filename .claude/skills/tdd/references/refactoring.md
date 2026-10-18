<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Refactor Candidates

After TDD cycle, look for:

- **Duplication** → Extract function/class
- **Long methods** → Break into private helpers (keep tests on public interface)
- **Shallow modules** → Combine or deepen
- **Feature envy** → Move logic to where data lives
- **Primitive obsession** → Introduce value objects
- **Existing code** the new code reveals as problematic

## Example: Extracting Duplication

After two TDD cycles, you notice repeated discount logic:

```text
BEFORE (duplication discovered during TDD):

  calculateSubtotal(cart) {
    let total = 0;
    for (const item of cart.items) {
      total += item.price * item.quantity;
      if (item.quantity >= 10) total -= item.price * item.quantity * 0.1;
    }
    return total;
  }

  calculateShipping(cart) {
    let itemsValue = 0;
    for (const item of cart.items) {
      itemsValue += item.price * item.quantity;
      if (item.quantity >= 10) itemsValue -= item.price * item.quantity * 0.1;
    }
    return itemsValue > 100 ? 0 : 5.99;
  }

AFTER (extract shared logic, tests still pass):

  lineTotal(item) {
    const base = item.price * item.quantity;
    return item.quantity >= 10 ? base * 0.9 : base;
  }

  calculateSubtotal(cart) {
    return cart.items.reduce((sum, item) => sum + lineTotal(item), 0);
  }

  calculateShipping(cart) {
    return calculateSubtotal(cart) > 100 ? 0 : 5.99;
  }
```

Run tests after each extraction step — never refactor while RED.
