---
title: Effective Java essentials
paths: ["**/*.java"]
---
- Prefer static factory methods or builders over telescoping constructors (Items 1–2).
- Minimize mutability: classes final where possible, fields private final; return defensive copies of mutable components (Items 17, 50).
- Always override hashCode when overriding equals, and obey the equals contract (Items 10–11).
- Prefer try-with-resources over try-finally for anything Closeable (Item 9).
- Never return null for collections; return empty collections. Use Optional as a return type only — never for fields or parameters (Items 54–55).
- Avoid raw types and unchecked casts; design generic APIs (Items 26–29).
- Use enums over int constants; EnumSet/EnumMap over bit fields and ordinal indexing (Items 34–38).
- Throw exceptions appropriate to the abstraction, document them, and never swallow exceptions in empty catch blocks (Items 69–77).
- Prefer interfaces to abstract classes for type definitions (Item 20).
- Never call overridable methods from constructors (Item 19).
- Avoid lazy initialization; when concurrency requires it, use the holder idiom or double-checked locking with volatile (Item 83).
