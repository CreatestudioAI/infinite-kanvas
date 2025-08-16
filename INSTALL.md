# Installation Instructions

## Prerequisites

- Node.js 18+ (recommended: Node.js 20)
- npm or yarn package manager
- A fal.ai account and API key (optional but recommended)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/fal-ai-community/infinite-kanvas.git
cd infinite-kanvas
```

### 2. Install Dependencies

```bash
npm install
```

This will automatically:
- Install all required dependencies
- Set up Husky pre-commit hooks
- Configure the development environment

### 3. Environment Setup

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# Required: Your fal.ai API key (get one at https://fal.ai/dashboard)
FAL_KEY=your_fal_api_key_here

# Required: Your app URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: For rate limiting (Vercel KV)
KV_REST_API_URL=your_vercel_kv_url
KV_REST_API_TOKEN=your_vercel_kv_token
```

### 4. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Getting Your fal.ai API Key

1. Visit [fal.ai](https://fal.ai) and create an account
2. Go to your [Dashboard](https://fal.ai/dashboard)
3. Navigate to the API Keys section
4. Create a new API key
5. Copy the key and add it to your `.env.local` file

**Note:** The app works without an API key but with rate limits. Adding your own key removes these limits and uses your fal.ai quota.

## Optional: Rate Limiting Setup

For production deployments, you can enable rate limiting using Vercel KV:

1. Create a Vercel KV database in your Vercel dashboard
2. Copy the `KV_REST_API_URL` and `KV_REST_API_TOKEN` from your KV settings
3. Add them to your `.env.local` file

Without these variables, rate limiting is disabled and all requests are allowed.

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Format code
npm run format:write

# Check formatting
npm run format:check

# Run pre-commit checks manually
npx lint-staged
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── fal/          # fal.ai proxy endpoint
│   │   └── trpc/         # tRPC API handlers
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Main canvas page
├── components/            # React components
│   ├── canvas/           # Canvas-specific components
│   └── ui/               # Reusable UI components
├── hooks/                # Custom React hooks
├── lib/                  # Utility libraries
│   ├── handlers/         # Business logic handlers
│   ├── models.ts         # Style model definitions
│   ├── storage.ts        # IndexedDB storage layer
│   └── video-models.ts   # Video model configurations
├── server/               # Server-side code
│   └── trpc/            # tRPC router and procedures
├── types/                # TypeScript type definitions
└── utils/                # Utility functions
```

## Key Features Setup

### Canvas Functionality
- **Infinite Canvas**: Pan with middle mouse or drag, zoom with scroll wheel
- **Image Upload**: Drag & drop images or click the "Add" button
- **Multi-selection**: Click and drag to select multiple images
- **Transformations**: Resize, rotate, and crop images

### AI Features
- **Style Transfer**: Select an image, choose a style, and click "Generate"
- **Background Removal**: Right-click → "Remove Background"
- **Object Isolation**: Right-click → "Isolate Object" → describe what to isolate
- **Text-to-Image**: Enter a prompt without selecting images and click "Generate"

### Video Features
- **Image-to-Video**: Right-click an image → "Image to Video"
- **Video Upload**: Drag & drop video files onto the canvas
- **Video Controls**: Click a video to show playback controls
- **Video Export**: Right-click a video → "Export GIF"

## Troubleshooting

### Common Issues

**1. "Rate limit exceeded" errors**
- Add your fal.ai API key to `.env.local`
- Restart the development server after adding the key

**2. Images not loading**
- Check browser console for CORS errors
- Ensure images are from allowed domains or uploaded as data URLs

**3. Canvas performance issues**
- Large images are automatically resized for display
- Use browser dev tools to monitor memory usage
- Clear IndexedDB storage if needed: `localStorage.clear()`

**4. Build errors**
- Ensure all environment variables are set
- Check that Node.js version is 18+
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`

### Development Tips

**Hot Reloading**
The development server supports hot reloading for most changes. Canvas state is preserved between reloads.

**Debugging**
- Open browser dev tools to see console logs
- Use React DevTools for component debugging
- Check Network tab for API request/response details

**Performance**
- The canvas uses viewport culling - only visible elements are rendered
- Images are automatically resized before upload to optimize performance
- IndexedDB stores original image data separately from canvas state

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard:
   - `FAL_KEY`
   - `NEXT_PUBLIC_APP_URL` (your production URL)
   - `KV_REST_API_URL` (optional)
   - `KV_REST_API_TOKEN` (optional)
4. Deploy

### Other Platforms

The app is built with standard Next.js and should work on any platform that supports:
- Node.js 18+
- Edge runtime compatibility
- Environment variables

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Run tests and linting: `npm run lint`
5. Commit with conventional commits format
6. Push and create a pull request

Pre-commit hooks will automatically format and lint your code.

## License

MIT - see LICENSE file for details.

## Support

- [fal.ai Documentation](https://fal.ai/docs)
- [GitHub Issues](https://github.com/fal-ai-community/infinite-kanvas/issues)
- [fal.ai Discord](https://discord.gg/fal-ai)