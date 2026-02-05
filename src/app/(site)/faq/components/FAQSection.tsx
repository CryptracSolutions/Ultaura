'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/core/ui/Accordion';
import type { FAQCategory } from '../faq-data';

interface FAQSectionProps {
  category: FAQCategory;
}

export function FAQSection({ category }: FAQSectionProps) {
  return (
    <section id={category.id} className="scroll-mt-32">
      <h2 className="text-xl font-semibold text-primary mb-2">
        {category.title}
      </h2>
      {category.description && (
        <p className="text-sm text-muted-foreground mb-4">
          {category.description}
        </p>
      )}
      <Accordion>
        {category.items.map((item) => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger className="hover:bg-muted/30">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
