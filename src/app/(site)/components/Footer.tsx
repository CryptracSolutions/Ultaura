import Link from 'next/link';

import Container from '~/core/ui/Container';
import LogoImage from '~/core/ui/Logo/LogoImage';

const YEAR = new Date().getFullYear();

function Footer() {
  return (
    <footer className={'py-8 lg:py-24 border-t border-border'}>
      <Container>
        <div className={'flex flex-col space-y-8 lg:flex-row lg:space-y-0'}>
          <div
            className={
              'flex w-full space-x-2 lg:w-4/12 xl:w-3/12' +
              ' xl:space-x-6 2xl:space-x-8'
            }
          >
            <div className={'flex flex-col space-y-4'}>
              <div>
                <LogoImage className={'w-[85px] md:w-[115px]'} />
              </div>

              <div>
                <p className={'text-sm text-muted-foreground'}>
                  Companionship, one call at a time.
                </p>
              </div>

              <div className={'flex text-xs text-muted-foreground'}>
                <p>
                  © {YEAR} Ultaura. All Rights Reserved.
                </p>
              </div>
            </div>
          </div>

          <div
            className={
              'flex flex-col space-y-8 lg:space-y-0 lg:space-x-6' +
              ' xl:space-x-16 2xl:space-x-20' +
              ' w-full lg:flex-row lg:justify-end'
            }
          >
            <div>
              <div className={'flex flex-col space-y-4'}>
                <FooterSectionHeading>Product</FooterSectionHeading>

                <FooterSectionList>
                  <FooterLink>
                    <Link href={'/pricing'}>Pricing</Link>
                  </FooterLink>
                  <FooterLink>
                    <Link href={'/#how-it-works'}>How It Works</Link>
                  </FooterLink>
                  <FooterLink>
                    <Link href={'/faq'}>FAQ</Link>
                  </FooterLink>
                </FooterSectionList>
              </div>
            </div>

            <div>
              <div className={'flex flex-col space-y-4'}>
                <FooterSectionHeading>Company</FooterSectionHeading>

                <FooterSectionList>
                  <FooterLink>
                    <Link href={'/about'}>About Us</Link>
                  </FooterLink>
                  <FooterLink>
                    <Link href={'/blog'}>Blog</Link>
                  </FooterLink>
                  <FooterLink>
                    <Link href={'/contact'}>Contact</Link>
                  </FooterLink>
                </FooterSectionList>
              </div>
            </div>

            <div>
              <div className={'flex flex-col space-y-4'}>
                <FooterSectionHeading>Legal</FooterSectionHeading>

                <FooterSectionList>
                  <FooterLink>
                    <Link href={'/terms'}>Terms of Service</Link>
                  </FooterLink>
                  <FooterLink>
                    <Link href={'/privacy'}>Privacy Policy</Link>
                  </FooterLink>
                  <FooterLink>
                    <Link href={'/accessibility'}>Accessibility</Link>
                  </FooterLink>
                </FooterSectionList>
              </div>
            </div>

            <div>
              <div className={'flex flex-col space-y-4'}>
                <FooterSectionHeading>Support</FooterSectionHeading>

                <FooterSectionList>
                  <FooterLink>
                    <Link href={'/docs'}>Help Center</Link>
                  </FooterLink>
                  <FooterLink>
                    <a href="mailto:support@ultaura.com">support@ultaura.com</a>
                  </FooterLink>
                </FooterSectionList>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
}

function FooterSectionHeading(props: React.PropsWithChildren) {
  return (
    <p>
      <span className={'font-semibold text-foreground'}>{props.children}</span>
    </p>
  );
}

function FooterSectionList(props: React.PropsWithChildren) {
  return (
    <ul className={'flex flex-col space-y-4 text-muted-foreground'}>
      {props.children}
    </ul>
  );
}

function FooterLink(props: React.PropsWithChildren) {
  return (
    <li
      className={
        'text-sm [&>a]:transition-colors [&>a]:hover:text-foreground'
      }
    >
      {props.children}
    </li>
  );
}

export default Footer;
