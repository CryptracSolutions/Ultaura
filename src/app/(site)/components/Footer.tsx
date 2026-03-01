'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PlayCircleIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

import Container from '~/core/ui/Container';
import Logo from '~/core/ui/Logo';
import NewsletterForm from './NewsletterForm';
import { FadeInWhenVisible } from '~/app/(site)/components/MotionWrappers';

const YEAR = new Date().getFullYear();

function Footer() {
  const pathname = usePathname() ?? '';
  const isBlogPostPage = pathname.startsWith('/blog/') && pathname !== '/blog';

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="border-t border-zinc-800">
      {/* Newsletter Banner — unchanged */}
      {!isBlogPostPage && (
        <div className="bg-zinc-950 text-zinc-300 py-6 lg:py-8">
          <Container>
            <FadeInWhenVisible>
              <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8 lg:gap-12">
                <div className="text-left space-y-1">
                  <p className="text-sm font-medium text-primary">
                    Subscribe to our newsletter
                  </p>
                  <p className="text-sm text-zinc-400">
                    Elder care tips and product updates, delivered weekly.
                  </p>
                </div>
                <div className="w-full sm:ml-auto sm:w-auto sm:min-w-[403px]">
                  <NewsletterForm source="footer" compact />
                </div>
              </div>
            </FadeInWhenVisible>
          </Container>
        </div>
      )}

      {/* Dark Footer */}
      <div className="bg-zinc-950 text-zinc-300">
        {/* Navigation Section */}
        <div className="pt-10 pb-8 lg:pt-12 lg:pb-10">
          <Container>
            <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 lg:gap-x-6 lg:gap-y-8">
              <div className="flex flex-col space-y-2.5">
                <FooterGroupHeading>Get started</FooterGroupHeading>
                <ul className="flex flex-col space-y-2">
                  <FooterLink>
                    <Link
                      href="/demo"
                      className="inline-flex items-center gap-2"
                    >
                      <PlayCircleIcon className="h-4 w-4" />
                      Sample call
                    </Link>
                  </FooterLink>
                  <FooterLink>
                    <Link href="/onboarding?type=family">
                      Setting up for a loved one?
                      <br />
                      Start here &rarr;
                    </Link>
                  </FooterLink>
                </ul>
              </div>

              <div className="flex flex-col space-y-2.5">
                <FooterGroupHeading>Product</FooterGroupHeading>
                <ul className="flex flex-col space-y-2">
                  <FooterLink>
                    <Link href="/pricing">Pricing</Link>
                  </FooterLink>
                  <FooterLink>
                    <Link href="/#how-it-works">How It Works</Link>
                  </FooterLink>
                  <FooterLink>
                    <Link href="/faq">FAQ</Link>
                  </FooterLink>
                </ul>
              </div>

              <div className="flex flex-col space-y-2.5">
                <FooterGroupHeading>Support</FooterGroupHeading>
                <ul className="flex flex-col space-y-2">
                  <FooterLink>
                    <Link href="/docs">Help Center</Link>
                  </FooterLink>
                  <FooterLink>
                    <Link href="/contact">Contact</Link>
                  </FooterLink>
                </ul>
              </div>

              <div className="flex flex-col space-y-2.5">
                <FooterGroupHeading>Company</FooterGroupHeading>
                <ul className="flex flex-col space-y-2">
                  <FooterLink>
                    <Link href="/vision">Our Vision</Link>
                  </FooterLink>
                  <FooterLink>
                    <Link href="/blog">Blog</Link>
                  </FooterLink>
                  <FooterLink>
                    <Link href="/contact">Contact</Link>
                  </FooterLink>
                </ul>
              </div>

              <div className="flex flex-col space-y-2.5">
                <FooterGroupHeading>Legal</FooterGroupHeading>
                <ul className="flex flex-col space-y-2">
                  <FooterLink>
                    <Link href="/terms">Terms of Service</Link>
                  </FooterLink>
                  <FooterLink>
                    <Link href="/privacy">Privacy Policy</Link>
                  </FooterLink>
                  <FooterLink>
                    <Link href="/accessibility">Accessibility</Link>
                  </FooterLink>
                </ul>
              </div>
            </div>
          </Container>
        </div>

        {/* Separator */}
        <Container>
          <hr className="border-zinc-800" />
        </Container>

        {/* Utilities Section — Social Media */}
        {/* TODO: Update hrefs when social media accounts are created */}
        <div className="py-6 lg:py-8">
          <Container>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={scrollToTop}
                className="flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-white"
              >
                Back to top
                <ChevronUpIcon className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-5">
                <a
                  href="#"
                  title="Ultaura on Facebook"
                  aria-label="Ultaura on Facebook"
                  className="text-zinc-400 transition-colors hover:text-white"
                >
                  <FacebookIcon className="h-5 w-5" />
                </a>
                <a
                  href="#"
                  title="Ultaura on X"
                  aria-label="Ultaura on X"
                  className="text-zinc-400 transition-colors hover:text-white"
                >
                  <XIcon className="h-5 w-5" />
                </a>
                <a
                  href="#"
                  title="Ultaura on Instagram"
                  aria-label="Ultaura on Instagram"
                  className="text-zinc-400 transition-colors hover:text-white"
                >
                  <InstagramIcon className="h-5 w-5" />
                </a>
                <a
                  href="#"
                  title="Ultaura on LinkedIn"
                  aria-label="Ultaura on LinkedIn"
                  className="text-zinc-400 transition-colors hover:text-white"
                >
                  <LinkedInIcon className="h-5 w-5" />
                </a>
              </div>
            </div>
          </Container>
        </div>

        {/* Separator */}
        <Container>
          <hr className="border-zinc-800" />
        </Container>

        {/* Base Section */}
        <div className="pt-6 pb-8 lg:pt-8 lg:pb-10">
          <Container>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-4">
                <Logo
                  className="h-8"
                  showWordmark
                  wordmarkClassName="text-primary text-lg"
                />

                <p className="text-sm text-zinc-400">
                  Companionship, one call at a time.
                </p>

                <p className="text-xs text-zinc-500">
                  &copy; {YEAR} Ultaura. All Rights Reserved.
                </p>
              </div>
            </div>
          </Container>
        </div>
      </div>
    </footer>
  );
}

function FooterGroupHeading({ children }: React.PropsWithChildren) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-primary">
      {children}
    </p>
  );
}

function FooterLink({ children }: React.PropsWithChildren) {
  return (
    <li className="text-xs text-zinc-300 [&>a]:transition-colors [&>a]:duration-200 [&>a]:hover:text-primary">
      {children}
    </li>
  );
}

/* Social media icon components — inline SVGs for brand marks */

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export default Footer;
