'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PlayCircleIcon } from '@heroicons/react/24/outline';

import Container from '~/core/ui/Container';
import Logo from '~/core/ui/Logo';
import NewsletterForm from './NewsletterForm';
import { FadeInWhenVisible } from '~/app/(site)/components/MotionWrappers';

const YEAR = new Date().getFullYear();

function Footer() {
  const pathname = usePathname() ?? '';
  const isBlogPostPage = pathname.startsWith('/blog/') && pathname !== '/blog';

  return (
    <footer
      className={
        isBlogPostPage
          ? 'py-8 lg:py-24 border-t border-border'
          : 'pb-8 lg:pb-24'
      }
    >
      {!isBlogPostPage && (
        <div className="bg-surface-subtle/50 py-6 mb-8 lg:py-8 lg:mb-12">
          <Container>
            <FadeInWhenVisible>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-start sm:gap-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Subscribe to our newsletter</p>
                  <p className="text-sm text-muted-foreground">Elder care tips and product updates, delivered weekly.</p>
                </div>
                <div className="w-full sm:ml-auto sm:w-auto sm:min-w-[280px]">
                  <NewsletterForm source="footer" compact />
                </div>
              </div>
            </FadeInWhenVisible>
          </Container>
        </div>
      )}
      <Container>
        <div className="flex flex-col space-y-8 lg:flex-row lg:space-y-0">
          <div className="flex w-full space-x-2 lg:w-4/12 xl:w-3/12 xl:space-x-6 2xl:space-x-8">
            <div className="flex flex-col space-y-4">
              <Logo
                className="h-10"
                showWordmark
                wordmarkClassName="text-2xl font-semibold leading-none"
              />
              <p className="text-sm text-muted-foreground">
                Companionship, one call at a time.
              </p>
              <p className="text-xs text-muted-foreground">
                © {YEAR} Ultaura. All Rights Reserved.
              </p>
            </div>
          </div>

          <div className="flex flex-col space-y-8 lg:space-y-0 lg:space-x-6 xl:space-x-16 2xl:space-x-20 w-full lg:flex-row lg:justify-end">
            <div className="flex flex-col space-y-4">
              <FooterSectionHeading>Product</FooterSectionHeading>
              <FooterSectionList>
                <FooterLink>
                  <Link href="/pricing">Pricing</Link>
                </FooterLink>
                <FooterLink>
                  <Link href="/#how-it-works">How It Works</Link>
                </FooterLink>
                <FooterLink>
                  <Link href="/faq">FAQ</Link>
                </FooterLink>
              </FooterSectionList>
            </div>

            <div className="flex flex-col space-y-4">
              <FooterSectionHeading>Company</FooterSectionHeading>
              <FooterSectionList>
                <FooterLink>
                  <Link href="/vision">Our Vision</Link>
                </FooterLink>
                <FooterLink>
                  <Link href="/blog">Blog</Link>
                </FooterLink>
                <FooterLink>
                  <Link href="/contact">Contact</Link>
                </FooterLink>
              </FooterSectionList>
            </div>

            <div className="flex flex-col space-y-4">
              <FooterSectionHeading>Legal</FooterSectionHeading>
              <FooterSectionList>
                <FooterLink>
                  <Link href="/terms">Terms of Service</Link>
                </FooterLink>
                <FooterLink>
                  <Link href="/privacy">Privacy Policy</Link>
                </FooterLink>
                <FooterLink>
                  <Link href="/accessibility">Accessibility</Link>
                </FooterLink>
              </FooterSectionList>
            </div>

            <div className="flex flex-col space-y-4">
              <FooterSectionHeading>Support</FooterSectionHeading>
              <FooterSectionList>
                <FooterLink>
                  <Link href="/docs">Help Center</Link>
                </FooterLink>
                <FooterLink>
                  <a href="mailto:support@ultaura.com">support@ultaura.com</a>
                </FooterLink>
              </FooterSectionList>
            </div>

            <div className="flex flex-col space-y-4">
              <FooterSectionHeading>Get started</FooterSectionHeading>
              <FooterSectionList>
                <FooterLink>
                  <Link href="/demo" className="inline-flex items-center gap-2">
                    <PlayCircleIcon className="h-4 w-4" />
                    Hear a sample call →
                  </Link>
                </FooterLink>
                <FooterLink>
                  <Link href="/onboarding?type=family">
                    Setting up for a parent? Start here →
                  </Link>
                </FooterLink>
              </FooterSectionList>
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
}

function FooterSectionHeading({ children }: React.PropsWithChildren) {
  return (
    <p className="font-semibold text-foreground">{children}</p>
  );
}

function FooterSectionList({ children }: React.PropsWithChildren) {
  return (
    <ul className="flex flex-col space-y-4 text-muted-foreground">
      {children}
    </ul>
  );
}

function FooterLink({ children }: React.PropsWithChildren) {
  return (
    <li className="text-sm [&>a]:transition-colors [&>a]:duration-200 [&>a]:hover:text-primary">
      {children}
    </li>
  );
}

export default Footer;
