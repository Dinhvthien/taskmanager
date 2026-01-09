# Production Deployment Checklist

## 🔒 Security

- [x] API base URL sử dụng biến môi trường
- [ ] Loại bỏ tất cả console.log trong production code
- [ ] Thêm error boundary để bắt lỗi React
- [ ] Kiểm tra CORS settings trên backend
- [ ] Thêm rate limiting cho API calls
- [ ] Xác thực token expiration handling

## 🚀 Performance

- [ ] Code splitting và lazy loading cho routes
- [ ] Optimize bundle size
- [ ] Image optimization
- [ ] Enable gzip compression
- [ ] CDN cho static assets

## 📝 Environment Variables

- [ ] Tạo file `.env.example` với tất cả biến môi trường
- [ ] Tạo file `.env.production` cho production
- [ ] Không commit file `.env` vào git
- [ ] Document tất cả environment variables

## 🐛 Error Handling

- [ ] Global error handler
- [ ] User-friendly error messages
- [ ] Error logging service (Sentry, LogRocket, etc.)
- [ ] 404 page
- [ ] Network error handling

## 📦 Build & Deployment

- [ ] Build script tối ưu
- [ ] Test production build locally
- [ ] Setup CI/CD pipeline
- [ ] Health check endpoint
- [ ] Monitoring và alerting

## ✅ Testing

- [ ] Unit tests cho critical functions
- [ ] Integration tests
- [ ] E2E tests cho critical flows
- [ ] Performance testing

## 📚 Documentation

- [ ] API documentation
- [ ] Deployment guide
- [ ] Environment setup guide
- [ ] Troubleshooting guide

