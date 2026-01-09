import logoImage from '../image.jpeg'

const Logo = ({ className = '' }) => {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="flex-shrink-0">
        <img 
          src={logoImage} 
          alt="Logo" 
          className="w-10 h-10 rounded-lg object-cover shadow-md"
        />
      </div>
      <div className="flex flex-col">
        <h1 className="text-lg font-bold text-gray-800 leading-tight">iTask</h1>
        <p className="text-xs text-gray-500 leading-tight">Quản lý công việc</p>
      </div>
    </div>
  )
}

export default Logo

