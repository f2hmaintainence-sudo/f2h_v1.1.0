# Ecosystem naming reference

Detailed conventions per ecosystem. Read the section for the ecosystem you are working in. In every case, an established repository convention outranks what is written here.

Sources are each ecosystem's own style authority, listed per section. Verify against current official documentation when a recommendation looks version-sensitive.

## PHP

Authority: PSR-1 (basic coding standard) and **PER Coding Style**, which extends and replaces PSR-12. PSR-12 is not formally withdrawn but is superseded; treat PER Coding Style as current.

| Element | Convention | Example |
|---|---|---|
| Class, interface, trait, enum | `PascalCase` | `OrderService`, `Arrayable`, `OrderStatus` |
| Method, function | `camelCase` | `createOrder`, `findByEmail` |
| Property | `camelCase`, visibility always declared | `private string $orderNumber` |
| Variable | `camelCase` | `$lineItems` |
| Constant | `UPPER_CASE` | `const MAX_RETRIES = 3` |
| Enum case | `PascalCase` is recommended | `OrderStatus::AwaitingPayment` |
| Namespace | `PascalCase`, mirrors directory path | `App\Services\Billing` |
| File | Exactly the class name plus `.php` | `OrderService.php` |

Rules that are not stylistic preferences:

- **PSR-4 autoloading maps namespace to directory path.** The file name MUST match the class name and the directory structure MUST match the namespace, case included. Renaming `OrderService.php` to `order-service.php` breaks autoloading.
- One class per file.
- Multi-letter acronyms are treated as words: `HttpClient`, `UrlGenerator`, `XmlParser`.
- `declare(strict_types=1);` where the project uses it — check whether it does before adding or omitting it.

## Laravel

Laravel's own generators define the convention. When unsure, run the relevant `make:` command in a scratch location and copy the naming it produces.

| Element | Convention | Example |
|---|---|---|
| Model | Singular `PascalCase` | `Order`, `OrderLineItem` |
| Table | Plural `snake_case` | `orders`, `order_line_items` |
| Column, foreign key | `snake_case` | `created_at`, `customer_id` |
| Pivot table | Both models, singular, alphabetical, `snake_case` | `order_product` |
| Controller | `PascalCase` + `Controller` | `OrderController` |
| Form request | `PascalCase` + `Request` | `StoreOrderRequest`, `UpdateOrderRequest` |
| API resource | `PascalCase` + `Resource` | `OrderResource` |
| Job | Imperative verb phrase | `ProcessOrder` |
| Event | Past-tense phrase | `OrderCreated` |
| Listener | Imperative verb phrase | `SendOrderConfirmation` |
| Policy | Model + `Policy` | `OrderPolicy` |
| Migration file | Timestamp + `snake_case` description | `2026_01_04_120000_create_orders_table.php` |
| Test class | `PascalCase` + `Test` | `OrderCreationTest` |
| Route name | Dot-delimited `snake_case` or kebab, matching existing routes | `orders.store` |
| Config key | `snake_case` | `services.stripe.secret` |
| Blade view | `snake_case` or kebab, matching existing views | `orders/show.blade.php` |

Eloquent infers the table name by pluralising the snake_cased model name, and the foreign key as the snake_cased model name plus `_id`. Following the convention removes configuration; deviating from it requires explicitly setting `$table` or `$foreignKey`.

## TypeScript and JavaScript

Authority: no single official style guide. The repository's convention is authoritative.

| Element | Convention | Example |
|---|---|---|
| Class, interface, type alias, enum | `PascalCase` | `OrderService`, `OrderStatus` |
| Function, method, variable | `camelCase` | `createOrder`, `lineItems` |
| Module-level constant | `UPPER_SNAKE_CASE` or `camelCase`, per repository | `MAX_RETRIES`, `defaultTimeoutMs` |
| Type parameter | Single capital or `PascalCase` | `T`, `TPayload` |
| React component | `PascalCase` | `ProductCard` |
| React hook | `use` + `PascalCase` remainder | `useCart` |
| Private field | `#field` or `private`, per repository | `#cache` |
| Directory | Matches the file convention | `order-processing/` |

File naming: pick up the repository's existing style — `kebab-case`, `camelCase`, `PascalCase`, or `snake_case`. Never mix. On case-insensitive filesystems a case-only difference between an import and a filename builds locally and fails in CI.

Notes:

- Do **not** prefix interfaces with `I` unless the repository already does. Modern TypeScript style omits it.
- Prefer `type` or `interface` consistently with the repository rather than alternating.
- Barrel files (`index.ts`) are a repository-level decision. They can defeat tree-shaking and create import cycles; do not introduce them where they do not exist.

## NestJS

NestJS's CLI generators define the convention, and the suffixes are load-bearing for readability across a large module tree.

```
src/
  orders/
    orders.module.ts
    orders.controller.ts
    orders.service.ts
    orders.controller.spec.ts
    dto/
      create-order.dto.ts
      update-order.dto.ts
    entities/
      order.entity.ts
    guards/
      orders.guard.ts
```

| Element | File | Class |
|---|---|---|
| Module | `orders.module.ts` | `OrdersModule` |
| Controller | `orders.controller.ts` | `OrdersController` |
| Service / provider | `orders.service.ts` | `OrdersService` |
| DTO | `create-order.dto.ts` | `CreateOrderDto` |
| Entity | `order.entity.ts` | `Order` |
| Guard | `roles.guard.ts` | `RolesGuard` |
| Interceptor | `logging.interceptor.ts` | `LoggingInterceptor` |
| Pipe | `parse-date.pipe.ts` | `ParseDatePipe` |
| Filter | `http-exception.filter.ts` | `HttpExceptionFilter` |
| Decorator | `current-user.decorator.ts` | `CurrentUser` |
| Test | `orders.service.spec.ts` | — |

Directory names are plural and match the feature; files inside carry the type suffix. Injection tokens for non-class providers are `UPPER_SNAKE_CASE` string or symbol constants.

## React

| Element | Convention | Example |
|---|---|---|
| Component | `PascalCase`, file matches the component | `ProductCard.tsx` |
| Hook | `use` prefix, `camelCase` file | `useCart.ts` |
| Context | `PascalCase` + `Context` | `CartContext` |
| Provider component | `PascalCase` + `Provider` | `CartProvider` |
| Props type | Component name + `Props` | `ProductCardProps` |
| Event handler prop | `on` + event | `onSelect` |
| Event handler implementation | `handle` + event | `handleSelect` |
| Higher-order component | `with` prefix | `withAuth` |

A component's file SHOULD be named for the component it exports. A directory per component is a repository-level choice; follow whichever exists.

## Next.js

Framework-reserved file names are **fixed** and case-sensitive. They are not style choices and MUST NOT be renamed: `page`, `layout`, `template`, `loading`, `error`, `global-error`, `not-found`, `route`, `default`, `proxy`, `instrumentation`, `middleware` (deprecated in favour of `proxy`), plus the metadata conventions (`favicon`, `icon`, `apple-icon`, `opengraph-image`, `twitter-image`, `sitemap`, `robots`).

Routing segment conventions, also fixed:

| Pattern | Meaning |
|---|---|
| `[slug]` | Dynamic segment |
| `[...slug]` | Catch-all segment |
| `[[...slug]]` | Optional catch-all segment |
| `(group)` | Route group — excluded from the URL |
| `_folder` | Private folder — opted out of routing |
| `@slot` | Named slot for a parallel route |
| `(.)folder`, `(..)folder`, `(...)folder` | Intercepting routes |

Because folders define URL segments, **route directory names are `kebab-case`** — they appear in the URL. Non-route directories follow the repository's TypeScript file convention.

## Dart and Flutter

Authority: Effective Dart style guide.

| Element | Convention | Example |
|---|---|---|
| Package, directory, source file | `lowercase_with_underscores` | `order_repository.dart` |
| Class, enum, typedef, extension, type parameter | `UpperCamelCase` | `OrderRepository`, `OrderStatus` |
| Member, top-level definition, variable, parameter | `lowerCamelCase` | `orderCount`, `httpRequest` |
| Constant and enum value | `lowerCamelCase` — **not** `SCREAMING_CAPS` | `const defaultTimeout = ...` |
| Import prefix | `lowercase_with_underscores` | `import 'dart:math' as math;` |
| Private identifier | Leading underscore | `_cachedOrders` |
| Test file | Source name + `_test.dart` | `order_repository_test.dart` |

Rules worth stating:

- File names are `snake_case` **even though the class inside is `UpperCamelCase`**. `order_repository.dart` contains `OrderRepository`. This is correct and MUST NOT be "fixed".
- Acronyms longer than two letters are capitalized like words: `HttpRequest`, `Uri`, `Nasa`. Two-letter acronyms that are capitalized in English stay capitalized: `ID`, `UI`, `TV`.
- Widget file names describe the widget: `product_card.dart` for `ProductCard`. Page or screen widgets commonly end in `_page.dart` or `_screen.dart` — follow whichever the project uses.

## SQL and relational schemas

| Element | Convention |
|---|---|
| Table | `snake_case`; plural or singular consistently with the existing schema |
| Column | `snake_case` |
| Primary key | `id`, unless the schema does otherwise |
| Foreign key | `<referenced_singular>_id`, e.g. `customer_id` |
| Index | `<table>_<columns>_idx` or the framework's generated name |
| Unique constraint | `<table>_<columns>_unique` |
| Junction table | Both table names, consistently ordered |
| Timestamps | Whatever the schema already uses (`created_at`/`updated_at` is most common) |

**MUST** match the existing schema's plurality and timestamp naming. A schema with both `orders` and `customer` is already inconsistent — follow the dominant pattern and note the inconsistency rather than adding a third variant.

Identifiers are contracts with stored data and with every query in the codebase. See the `database` skill before renaming one.

## Other ecosystems

When working outside the ecosystems above, apply the resolution order from `SKILL.md` and locate the language's own authority — for example Go's `gofmt` and effective-Go naming, Rust's `rustfmt` and RFC 430 conventions, Python's PEP 8, or .NET's framework design guidelines. Read the repository's neighbours first regardless.
