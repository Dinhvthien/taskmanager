# Production Deployment Guide

## 🔴 Critical Issues to Fix Before Production

### 1. Environment Variables
- ✅ API base URL đã sử dụng biến môi trường `VITE_API_BASE_URL`
- ⚠️ Cần tạo file `.env.production` với API URL production
- ⚠️ Không commit file `.env` vào git (thêm vào `.gitignore`)

### 2. Console Statements
- ⚠️ Có **142 console.log/error** statements trong code
- ✅ Đã sửa một số console.log quan trọng để chỉ chạy trong development
- ⚠️ Cần review và sửa tất cả console statements còn lại

### 3. Error Handling
- ⚠️ Một số error chỉ log ra console, cần có error logging service
- ⚠️ Cần thêm Error Boundary cho React components
- ⚠️ Cần user-friendly error messages

### 4. Security
- ⚠️ Token lưu trong localStorage (có thể bị XSS attack)
- ⚠️ Cần thêm CSRF protection
- ⚠️ Cần validate input phía client và server

### 5. Performance
- ⚠️ Chưa có code splitting cho routes
- ⚠️ Chưa optimize images
- ⚠️ Cần lazy loading cho components lớn

### 6. Build Configuration
- ⚠️ Vite config có hardcoded localhost (chỉ dùng cho dev)
- ✅ Production build sẽ không dùng proxy này

## 📋 Pre-Deployment Checklist

### Environment Setup
```bash
# 1. Tạo file .env.production
VITE_API_BASE_URL=https://api.yourdomain.com/api
NODE_ENV=production

# 2. Build production
npm run build

# 3. Test production build locally
npm run preview
```

### Code Review
- [ ] Loại bỏ tất cả console.log không cần thiết
- [ ] Kiểm tra tất cả hardcoded URLs
- [ ] Review error handling
- [ ] Test authentication flow
- [ ] Test tất cả critical user flows

### Security
- [ ] Enable HTTPS
- [ ] Setup CORS properly
- [ ] Review authentication/authorization
- [ ] Input validation
- [ ] XSS protection

### Performance
- [ ] Bundle size optimization
- [ ] Image optimization
- [ ] Lazy loading
- [ ] Code splitting

### Monitoring
- [ ] Setup error tracking (Sentry, LogRocket)
- [ ] Setup analytics
- [ ] Health check endpoints
- [ ] Logging service

## 🚀 Deployment Steps

1. **Build for production:**
   ```bash
   npm run build
   ```

2. **Test locally:**
   ```bash
   npm run preview
   ```

3. **Deploy to server:**
   - Upload `dist/` folder to web server
   - Configure web server (Nginx/Apache) to serve static files
   - Setup reverse proxy for API calls

4. **Configure environment:**
   - Set `VITE_API_BASE_URL` environment variable
   - Ensure backend API is accessible

5. **Verify:**
   - Test all critical flows
   - Check error handling
   - Verify API connectivity
   - Test authentication

## 📝 Notes

- Vite sẽ tự động loại bỏ code trong `if (process.env.NODE_ENV === 'development')` khi build production
- Proxy trong `vite.config.js` chỉ dùng cho development, không ảnh hưởng production build
- Cần configure web server để handle client-side routing (SPA)

