# High Fives - Express Gratitude

A simple platform that allows you to send a High Five to a bitcoiner to express gratitude and/or recognize their work. A High Five is simply a note accompanied by an optional payment (as honorarium) in bitcoin.

## 🌟 Features

- **Lightning Network Payments**: Send Bitcoin payments instantly with Lightning Network integration
- **Nostr Protocol Integration**: High Fives are posted to Nostr
- **Mobile-First Design**: Responsive design optimized for mobile devices
- **Lightning Address Support**: Send payments using Lightning addresses and npub identifiers
- **BOLT12 Payments**: Support for BIP-353 Bitcoin addresses 

## 🚀 Technology Stack

### Frontend
- **React** with TypeScript
- **Wouter** for client-side routing
- **TanStack Query** for data fetching and caching
- **Shadcn/UI** + **Tailwind CSS** for modern, accessible UI components
- **Framer Motion** for smooth animations
- **React Hook Form** with Zod validation

### Backend
- **Node.js** with Express
- **TypeScript** for type safety
- **Drizzle ORM** for database operations
- **PostgreSQL** for data persistence
- **WebSocket** for real-time features

### Blockchain & Protocols
- **Lightning Network** for instant Bitcoin payments
- **Nostr Protocol** for decentralized social features
- **@getalby/lightning-tools** for Lightning Network utilities
- **@nostr-dev-kit/ndk** for Nostr protocol implementation

## 📋 Prerequisites

- Node.js 20 or higher
- PostgreSQL database
- Lightning Network access (optional, for payment features)
- Nostr relay access (optional, for social features)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd high-five-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/highfive
   NODE_ENV=development
   ```

4. **Set up the database**
   ```bash
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5000`

## 🔧 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - Run TypeScript type checking
- `npm run db:push` - Push database schema changes

## 🏗️ Project Structure

```
├── client/                 # Frontend React application
│   └── src/
│       ├── components/     # Reusable UI components
│       ├── pages/          # Route components
│       └── lib/            # Utilities and configurations
├── server/                 # Backend Express application
│   ├── routes.ts          # API route definitions
│   ├── storage.ts         # Data storage interface
│   ├── nostr-*.ts         # Nostr protocol integrations
│   ├── lightning-*.ts     # Lightning Network utilities
│   └── blossom-*.ts       # Blossom file storage
├── shared/                # Shared types and schemas
│   └── schema.ts          # Database schema and types
└── package.json
```

## 🔌 Key Integrations

### Lightning Network
- Lightning address lookup and invoice generation
- Support for BIP-353 Bitcoin payment instructions
- QR code generation for payment requests
- Integration with Lightning service providers

### Nostr Protocol
- Publishing high-five events to Nostr relays
- Profile information retrieval using npub identifiers
- Direct messaging capabilities
- File sharing through Nostr events


## 🚀 Deployment

### Replit Deployment
This project is configured for easy deployment on Replit:

1. The application will automatically build using `npm run build`
2. Production server starts with `npm run start`
3. Database migrations run automatically

### Manual Deployment
For other platforms:

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Set production environment variables**
   ```env
   NODE_ENV=production
   DATABASE_URL=<your-production-database-url>
   ```

3. **Start the production server**
   ```bash
   npm run start
   ```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Lightning Network](https://lightning.network/) for instant Bitcoin payments
- [Nostr Protocol](https://nostr.com/) for decentralized social networking
- [Shadcn/UI](https://ui.shadcn.com/) for beautiful UI components
- [Drizzle ORM](https://orm.drizzle.team/) for type-safe database operations

## 📞 Support

For support, please open an issue in the GitHub repository or contact the maintainers.

---

Made with ❤️ for the Bitcoin and Nostr communities