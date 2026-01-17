export default function DriverLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <main className="pb-32 md:pb-36">
            {children}
        </main>
    );
}
