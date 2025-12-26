# IQL - Hệ thống Quản lý Công việc

Frontend application được xây dựng bằng React.js và Tailwind CSS.

## Công nghệ sử dụng

- **React 18** - Thư viện JavaScript cho xây dựng giao diện người dùng
- **Vite** - Build tool nhanh và hiện đại
- **Tailwind CSS** - Framework CSS utility-first
- **React Router** - Routing cho single-page application
- **Axios** - HTTP client cho API calls

## Cài đặt

1. Cài đặt dependencies:
```bash
npm install
```

## Chạy ứng dụng

Chạy development server:
```bash
npm run dev
```

Ứng dụng sẽ chạy tại `http://localhost:3000`

## Build cho production

```bash
npm run build
```

Build files sẽ được tạo trong thư mục `dist/`

## Preview production build

```bash
npm run preview
```

## Cấu trúc thư mục

```
frontend/
├── public/          # Static files
├── src/
│   ├── components/  # React components
│   ├── pages/       # Page components
│   ├── services/    # API services
│   ├── utils/       # Utility functions
│   ├── App.jsx      # Main App component
│   ├── main.jsx     # Entry point
│   └── index.css    # Global styles
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Kết nối với Backend

Backend API đang chạy tại `http://localhost:8080`. Proxy đã được cấu hình trong `vite.config.js` để forward các request `/api/*` đến backend.

## Scripts

- `npm run dev` - Chạy development server
- `npm run build` - Build cho production
- `npm run preview` - Preview production build
- `npm run lint` - Chạy ESLint

