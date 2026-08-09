# Frontend Architecture

This project is intentionally frontend-only at the start and is organized around browser-side payroll logic.

## Primary layers

- components: reusable UI sections and forms
- pages: top-level screens
- features: domain workflows and feature modules
- engines: calculation logic and rule tables
- data: static reference data and policy defaults
- utils: generic helpers
- hooks: reusable stateful browser logic
- storage: localStorage/sessionStorage wrappers

## Planned responsibilities

- rule tables and configuration handled on the client
- calculation engines for gross pay, deductions, taxes, and net pay
- local browser persistence for saved scenarios
- export utilities for CSV/JSON/PDF-style content generation in-browser
