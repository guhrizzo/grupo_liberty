import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import RouteLoadingBar from "./components/RouteLoadingBar";
import MotionProvider from "./components/MotionProvider";
import { ToastProvider } from "./components/ui";
import PublicLayoutWrapper from "./components/PublicLayoutWrapper";
import { DashboardThemeProvider } from "./components/DashboardThemeProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Liberty Car | Veículos",
  description:
    "Encontre o veículo ideal na Liberty Car. Confira nosso estoque completo com as melhores condições.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${poppins.variable} h-full antialiased`}
    >

      {/* `suppressHydrationWarning`: o script anti-flash do
          DashboardThemeProvider adiciona `adobe-dark` ao <body> antes da
          hidratação, então a classe do cliente diverge da do servidor de
          propósito. Sem isso o React acusa mismatch a cada carregamento. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <DashboardThemeProvider>
          <RouteLoadingBar />
          <MotionProvider>
            <ToastProvider>
              <PublicLayoutWrapper>{children}</PublicLayoutWrapper>
            </ToastProvider>
          </MotionProvider>
        </DashboardThemeProvider>
      </body>
    </html>
  );
}