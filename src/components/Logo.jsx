const Logo = ({ className = '' }) => {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="flex-shrink-0">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
          <svg 
            className="w-6 h-6 text-white" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" 
            />
          </svg>
        </div>
      </div>
      <div className="flex flex-col">
        <h1 className="text-lg font-bold text-gray-800 leading-tight">IQL</h1>
        <p className="text-xs text-gray-500 leading-tight">Quản lý công việc</p>
      </div>
    </div>
  )
}

export default Logo

