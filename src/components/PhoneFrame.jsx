export default function PhoneFrame({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-0 py-0 sm:px-4 sm:py-8 font-sans">
      <div className="min-w-0 w-full max-w-[430px] min-h-screen sm:min-h-[700px] sm:h-[calc(100vh-4rem)] sm:max-h-[900px] bg-white rounded-none sm:rounded-[2.5rem] shadow-none sm:shadow-2xl overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  )
}
