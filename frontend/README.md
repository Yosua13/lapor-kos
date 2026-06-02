# Lapor Kos - Frontend

This is the frontend for the Lapor Kos application, built with [Next.js](https://nextjs.org/).

## Prerequisites

- Node.js (v22.x recommended)
- npm or yarn

## Environment Variables

Create a `.env.local` file in the root of the `frontend` directory with the following configuration:

```env
# The base URL of the backend API
NEXT_PUBLIC_API_URL=http://your_backend_url:8081
```

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Available Commands

- `npm run dev`: Starts the development server.
- `npm run build`: Builds the app for production.
- `npm run start`: Runs the built app in production mode.
- `npm run lint`: Runs ESLint to find and fix problems.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
