'use client';

import Link from 'next/link';

import { useState } from 'react';
import { EllipsisVerticalIcon } from '@heroicons/react/24/outline';

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '~/core/ui/Table';
import TableContainer from '~/core/ui/TableContainer';
import TableEmptyState from '~/core/ui/TableEmptyState';
import TablePagination from '~/core/ui/TablePagination';
import { formatDateTime } from '~/lib/utils/format-date';

import FeedbackSubmission from '~/plugins/feedback-popup/lib/feedback-submission';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/core/ui/Dropdown';

import If from '~/core/ui/If';
import Button from '~/core/ui/Button';
import Modal from '~/core/ui/Modal';

import FeedbackBadge from '~/plugins/feedback-popup/admin/FeedbackBadge';

import { deleteFeedbackSubmissionAction } from '~/plugins/feedback-popup/lib/feedback-actions';

function FeedbackDataTable({
  submissions,
  page,
  count,
  perPage,
}: React.PropsWithChildren<{
  submissions: FeedbackSubmission[];
  count: number;
  page: number;
  perPage: number;
}>) {
  const pageCount = Math.ceil(count / perPage);

  return (
    <TableContainer>
      {submissions.length === 0 ? (
        <TableEmptyState message="No feedback submissions found." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead className="w-[200px]">Text</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Language</TableHead>
              <TableHead>Screen Size</TableHead>
              <TableHead>Date</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissions.map((submission) => {
              let text = submission.text;
              if (text.length >= 35) {
                text = text.slice(0, 35) + '...';
              }

              const screenSize = submission.deviceInfo?.screen_size;

              return (
                <TableRow key={submission.id}>
                  <TableCell>
                    <FeedbackBadge type={submission.type} />
                  </TableCell>
                  <TableCell>
                    <Link
                      className="hover:underline w-full h-full"
                      href={`/admin/feedback/${submission.id}`}
                    >
                      {text}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {submission.userId ? (
                      <Link
                        className="hover:underline w-full h-full"
                        href={`/admin/users/${submission.userId}`}
                      >
                        View User
                      </Link>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {(submission as any).deviceInfo?.language ?? '-'}
                  </TableCell>
                  <TableCell>
                    {screenSize
                      ? `${screenSize.width}x${screenSize.height}`
                      : '-'}
                  </TableCell>
                  <TableCell>{formatDateTime(submission.createdAt)}</TableCell>
                  <TableCell>
                    <FeedbackActions submission={submission} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <TablePagination
        page={page}
        pageCount={pageCount}
        perPage={perPage}
        totalCount={count}
      />
    </TableContainer>
  );
}

export default FeedbackDataTable;

function FeedbackActions(
  props: React.PropsWithChildren<{
    submission: FeedbackSubmission;
  }>,
) {
  const { id, type, email } = props.submission;
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost">
          <span className="flex space-x-2 items-center">
            <EllipsisVerticalIcon className="h-4" />
            <span>More</span>
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuItem>
          <Link className="w-full h-full" href={`feedback/${id}`}>
            View
          </Link>
        </DropdownMenuItem>

        <If condition={type === 'question'}>
          <DropdownMenuItem>
            <Link className="w-full h-full" href={`mailto:${email}`}>
              Reply
            </Link>
          </DropdownMenuItem>
        </If>

        <DropdownMenuItem
          onClick={() => setModalOpen(true)}
          onSelect={(e) => e.preventDefault()}
        >
          Delete
        </DropdownMenuItem>

        <Modal isOpen={modalOpen} heading="Delete Feedback Submission">
          <form
            action={async (data) => {
              setModalOpen(false);

              await deleteFeedbackSubmissionAction(data);
            }}
          >
            <input value={id} type="hidden" name="id" />

            <div className="flex flex-col space-y-4">
              <div>
                <p className="text-sm">
                  Are you sure you want to delete this feedback submission?
                </p>
              </div>

              <div className="flex justify-end">
                <Button variant="destructive">Yep, delete it</Button>
              </div>
            </div>
          </form>
        </Modal>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
