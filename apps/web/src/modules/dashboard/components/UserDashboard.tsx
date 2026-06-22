
import Image from "next/image";

export function UserDashboard() {

  return (
    <section className="max-h-screen ">
      <Image
        alt="Login Logo"
        className="mx-auto h-screen w-screen object-contain"
        height={800}
        priority
        src="/login-logo.svg"
        width={1200}
      />
      </section>
  );
}
