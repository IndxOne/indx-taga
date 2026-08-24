export default function PhoneFrame({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8 font-sans">
      <div className="w-full max-w-[430px] min-h-[700px] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  )
}
