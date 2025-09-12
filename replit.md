# Overview

This is a melody generator web application built with React and Node.js. The app allows users to create musical melodies by configuring parameters like tempo, scale, key, and note count. It uses Tone.js for audio synthesis and playback, providing an interactive music creation experience in the browser.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **React SPA**: Single-page application using React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **UI Framework**: Shadcn/ui components built on Radix UI primitives with Tailwind CSS
- **State Management**: React hooks for local component state, TanStack Query for server state
- **Audio Processing**: Tone.js integration for melody generation and audio playback
- **Build Tool**: Vite for fast development and optimized production builds

## Backend Architecture
- **Express Server**: Node.js server with Express framework using ES modules
- **Development Setup**: Hot reload with Vite integration in development mode
- **Static Serving**: Production builds served as static files
- **API Structure**: RESTful API endpoints prefixed with `/api`
- **Error Handling**: Centralized error handling middleware

## Data Storage
- **Database**: PostgreSQL with Neon Database serverless connection
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations and schema changes
- **Fallback Storage**: In-memory storage implementation for development

## Authentication & Authorization
- **User Management**: Basic user schema with username/password fields
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple
- **Storage Interface**: Abstracted storage layer supporting both database and in-memory implementations

## External Dependencies

### Core Framework Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL database connection
- **drizzle-orm & drizzle-kit**: Type-safe ORM and migration toolkit
- **express**: Web server framework
- **react & react-dom**: Frontend UI library
- **typescript**: Type safety across the entire stack

### UI and Styling
- **@radix-ui/***: Comprehensive set of accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Type-safe CSS class variants
- **lucide-react**: Icon library

### State Management and Data Fetching
- **@tanstack/react-query**: Server state management and caching
- **react-hook-form**: Form handling with validation
- **@hookform/resolvers**: Form validation resolvers

### Audio Processing
- **Tone.js**: Web Audio API wrapper for music synthesis (loaded via CDN)

### Development Tools
- **vite**: Build tool and development server
- **@replit/vite-plugin-***: Replit-specific development enhancements
- **tsx**: TypeScript execution for Node.js
- **esbuild**: Fast JavaScript bundler for production builds