import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  Play,
  Sparkles,
  ShieldCheck,
  Store,
  ScanSearch,
  Wand2,
  MessageSquareText,
  Mic,
  Zap,
} from "lucide-react";

const DEMO_VIDEO_URL =
  ""; // TODO: set later. Example YouTube embed: "https://www.youtube.com/embed/VIDEO_ID"

type LinkButtonProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "outline";
  className?: string;
};

function LinkButton({ href, children, variant = "primary", className = "" }: LinkButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2";
  const primary =
    "bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-lg hover:from-indigo-600 hover:to-blue-600";
  const outline =
    "border border-gray-200 bg-white/80 text-gray-900 hover:bg-white";

  const variantClass = variant === "outline" ? outline : primary;

  return (
    <Link href={href} className={`${base} ${variantClass} ${className}`}>
      {children}
    </Link>
  );
}

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-100">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-blue-200/40 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-10 sm:py-14">
        {/* Header */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-500 shadow-lg" />
            <div>
              <div className="text-sm font-semibold text-gray-900">EFRO</div>
              <div className="text-xs text-gray-500">Avatar-Seller für Shopify & Custom Shops</div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <LinkButton href="/demo" variant="outline">
              Demo
            </LinkButton>

            <LinkButton href="/efro/onboarding">
              Installieren <ArrowRight size={18} />
            </LinkButton>
          </div>
        </header>

        {/* Hero */}
        <section className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10">
          <Card className="rounded-2xl shadow-xl">
            <CardHeader>
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                <Sparkles size={14} />
                Early Access verfügbar
              </div>

              <CardTitle className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
                EFRO verkauft in deinem Shop – wie ein Profi.
              </CardTitle>

              <p className="mt-4 text-lg text-gray-600">
                Avatar + Chat + Voice. EFRO versteht Intent, Budget, Kategorie und Attribute – zeigt passende Produkte sofort
                und hilft dir zusätzlich, deinen Katalog so zu optimieren, dass EFRO (und dein Shop) besser konvertiert.
              </p>

              <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-sm text-indigo-900">
                <div className="flex items-start gap-2">
                  <ShieldCheck size={18} className="mt-0.5 text-indigo-700" />
                  <div>
                    <div className="font-semibold">DSGVO-Hinweis</div>
                    <div className="text-indigo-800/80">
                      EFRO begrüßt Besucher erst nach Klick auf „Start“ (keine Auto-Audio/Auto-Tracking).
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="flex flex-col gap-3 sm:flex-row">
                <LinkButton
                  href="/avatar-seller?shop=demo"
                  className="hover:scale-[1.01] transition-transform"
                >
                  Live Demo starten <Play size={18} />
                </LinkButton>

                <LinkButton href="#video" variant="outline">
                  Video ansehen
                </LinkButton>

                <LinkButton href="#early-access" variant="outline">
                  Early Access
                </LinkButton>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FeatureMini icon={<MessageSquareText size={18} />} title="Verkäufer-Dialog" desc="Klar, schnell, verkaufsstark – wie ein Profi." />
                <FeatureMini icon={<Mic size={18} />} title="Voice optional" desc="Natürliche Stimme (z. B. ElevenLabs)." />
                <FeatureMini icon={<Zap size={18} />} title="Sofort Empfehlungen" desc="Produkte im Panel – passend zu Intent & Budget." />
                <FeatureMini icon={<Wand2 size={18} />} title="Katalog-Optimierung" desc="Titel/Tags/Beschreibungen verbessern lassen." />
              </div>
            </CardContent>
          </Card>

          {/* Video card */}
          <Card id="video" className="rounded-2xl shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-gray-900">
                Sieh EFRO live im Demo-Shop
              </CardTitle>
              <p className="text-gray-600">
                Kurzes Video: Ich stelle Fragen im Demo-Shopify-Shop – EFRO antwortet, empfiehlt Produkte und zeigt den Flow.
              </p>
            </CardHeader>

            <CardContent>
              <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <div className="aspect-video w-full bg-gradient-to-br from-indigo-50 via-white to-blue-50">
                  {DEMO_VIDEO_URL ? (
                    <iframe
                      className="h-full w-full"
                      src={DEMO_VIDEO_URL}
                      title="EFRO Demo Video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-lg">
                        <Play size={20} />
                      </div>
                      <div className="font-semibold text-gray-900">Video-Link fehlt noch</div>
                      <div className="text-sm text-gray-600">
                        Setze oben in dieser Datei <span className="font-mono">DEMO_VIDEO_URL</span> (YouTube/Vimeo Embed),
                        dann erscheint hier automatisch das Video.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <LinkButton href="/demo">
                  Demo-Seite öffnen <ArrowRight size={18} />
                </LinkButton>
                <LinkButton href="/efro/onboarding" variant="outline">
                  Installations-Flow ansehen
                </LinkButton>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* How it works */}
        <section className="mt-10">
          <div className="mb-4 flex items-center gap-2 text-gray-900">
            <Store size={18} className="text-indigo-600" />
            <h2 className="text-2xl font-bold">So läuft die Installation ab</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StepCard
              icon={<Store size={18} />}
              title="1) Installieren (Shopify Embedded App)"
              desc="Du installierst EFRO im Shopify Admin. (Später mit OAuth + Billing)."
            />
            <StepCard
              icon={<ScanSearch size={18} />}
              title="2) Katalog scannen"
              desc="EFRO liest Produkte/Collections und baut eine robuste Datenbasis für Empfehlungen auf."
            />
            <StepCard
              icon={<Wand2 size={18} />}
              title="3) Optimierungsvorschläge"
              desc="EFRO zeigt konkrete Vorschläge: Titel, Tags, Beschreibungen – damit Suche & Empfehlungen besser performen."
            />
          </div>

          <div className="mt-4 rounded-2xl border bg-white/70 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck size={18} className="mt-0.5 text-indigo-700" />
              <div className="text-sm text-gray-700">
                <span className="font-semibold text-gray-900">Wichtig:</span> Besucher werden im Shop begrüßt, aber aus DSGVO-Gründen
                startet Voice/Interaktion erst nach einem Klick auf „Start“. Danach läuft die Konversation wie bei einem echten Verkäufer.
              </div>
            </div>
          </div>
        </section>

        {/* Early access */}
        <section id="early-access" className="mt-10">
          <div className="mb-4 flex items-center gap-2 text-gray-900">
            <Sparkles size={18} className="text-indigo-600" />
            <h2 className="text-2xl font-bold">Early Access</h2>
          </div>

          <p className="mb-5 text-gray-600">
            Early Access ist günstiger und hilft dir, EFRO früh in deinem Shop zu testen. Später sind die regulären Preise höher
            (Ziel: 299€/699€/999€).
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <PricingCard
              price="49€"
              title="Starter (Early)"
              bullets={[
                "Avatar + Chat Grundflow",
                "Basis Empfehlungen (Intent/Budget/Kategorie)",
                "Demo-Shop & Onboarding",
              ]}
            />
            <PricingCard
              price="149€"
              title="Pro (Early)"
              bullets={[
                "Alles aus Starter",
                "Voice (optional)",
                "Mehr Log-Einblicke (Operator-Sicht)",
              ]}
              highlight
            />
            <PricingCard
              price="299€"
              title="Enterprise (Early)"
              bullets={[
                "Alles aus Pro",
                "Katalog-Optimierung (Titel/Tags/Beschreibung) priorisiert",
                "Priorisierte Betreuung/Feedback-Loop",
              ]}
            />
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <LinkButton href="/efro/onboarding">
              Early Access starten <ArrowRight size={18} />
            </LinkButton>
            <LinkButton href="/demo" variant="outline">
              Erst Demo testen
            </LinkButton>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-10">
          <div className="mb-4 flex items-center gap-2 text-gray-900">
            <ShieldCheck size={18} className="text-indigo-600" />
            <h2 className="text-2xl font-bold">FAQ</h2>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <FaqItem
              q="Warum muss der Gast auf „Start“ klicken?"
              a="DSGVO-freundlich: keine automatische Audio-Wiedergabe / Interaktion ohne Einwilligung. Danach kann EFRO normal sprechen & verkaufen."
            />
            <FaqItem
              q="Was passiert während der Installation?"
              a="EFRO wird als Shopify Embedded App installiert, scannt den Katalog (Produkte/Collections) und baut daraus eine robuste Empfehlungsgrundlage."
            />
            <FaqItem
              q="Welche Optimierungen schlägt EFRO vor?"
              a="Konkrete Vorschläge für bessere Produkttitel, Tags/Keywords und Beschreibungen – damit Suche & Empfehlungen im Shop besser funktionieren."
            />
            <FaqItem
              q="Funktioniert EFRO später auch in Custom Shops?"
              a="Ja. Ziel ist: Shopify zuerst – danach Einbettung auch auf selbstgebauten Shops (Widget/Script-Integration)."
            />
          </div>
        </section>

        {/* Footer CTA */}
        <footer className="mt-12 rounded-2xl border bg-white/70 p-6 shadow-sm">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="text-xl font-bold text-gray-900">Bereit für einen Profi-Seller im Shop?</div>
              <div className="text-gray-600">
                Erst Demo testen – dann installieren. EFRO verkauft, du skalierst.
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <LinkButton href="/demo" variant="outline">
                Demo öffnen
              </LinkButton>
              <LinkButton href="/efro/onboarding">
                Installieren <ArrowRight size={18} />
              </LinkButton>
            </div>
          </div>

          <div className="mt-5 text-xs text-gray-500">
            © {new Date().getFullYear()} EFRO • app.avatarsalespro.com
          </div>
        </footer>
      </div>
    </main>
  );
}

function FeatureMini({
  icon,
  title,
  desc,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border bg-white/70 p-4 shadow-sm">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
        {icon}
      </div>
      <div>
        <div className="font-semibold text-gray-900">{title}</div>
        <div className="text-sm text-gray-600">{desc}</div>
      </div>
    </div>
  );
}

function StepCard({
  icon,
  title,
  desc,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Card className="rounded-2xl bg-white/70 shadow-sm">
      <CardHeader>
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-lg">
          {icon}
        </div>
        <CardTitle className="mt-3 text-lg font-bold text-gray-900">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-gray-600">{desc}</CardContent>
    </Card>
  );
}

function PricingCard({
  price,
  title,
  bullets,
  highlight,
}: {
  price: string;
  title: string;
  bullets: string[];
  highlight?: boolean;
}) {
  return (
    <Card className={`rounded-2xl bg-white/70 shadow-sm ${highlight ? "border-indigo-300 shadow-md" : ""}`}>
      <CardHeader>
        <CardTitle className="text-lg font-bold text-gray-900">{title}</CardTitle>
        <div className="mt-2 text-3xl font-extrabold text-gray-900">{price}</div>
        <div className="text-sm text-gray-500">pro Monat (Early Access)</div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm text-gray-700">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <span className="mt-1 text-indigo-600">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5">
          <LinkButton
            href="/efro/onboarding"
            variant={highlight ? "primary" : "outline"}
            className={`w-full ${highlight ? "" : ""}`}
          >
            Starten <ArrowRight size={18} />
          </LinkButton>
        </div>
      </CardContent>
    </Card>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="rounded-2xl border bg-white/70 p-4 shadow-sm">
      <summary className="cursor-pointer list-none font-semibold text-gray-900">
        {q}
      </summary>
      <div className="mt-2 text-sm text-gray-600">{a}</div>
    </details>
  );
}
