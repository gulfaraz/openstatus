"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { insertStatusReportSchema } from "@openstatus/db/src/schema";
import type {
  InsertStatusReport,
  Monitor,
  Page,
} from "@openstatus/db/src/schema";
import { Form } from "@openstatus/ui";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/dashboard/tabs";
import { useToastAction } from "@/hooks/use-toast-action";
import { api } from "@/trpc/client";
import { SaveButton } from "../shared/save-button";
import { General } from "./general";
import { SectionConnect } from "./section-connect";
import { SectionUpdateMessage } from "./section-update-message";

interface Props {
  defaultSection?: string;
  defaultValues?: InsertStatusReport;
  monitors?: Monitor[];
  pages?: Page[];
  nextUrl?: string;
}

export function StatusReportForm({
  defaultSection,
  defaultValues,
  monitors,
  pages,
  nextUrl,
}: Props) {
  const form = useForm<InsertStatusReport>({
    resolver: zodResolver(insertStatusReportSchema),
    defaultValues: defaultValues
      ? {
          id: defaultValues.id,
          title: defaultValues.title,
          status: defaultValues.status,
          monitors: defaultValues.monitors,
          pages: defaultValues.pages,
          // include update on creation
          message: defaultValues.message,
          date: defaultValues.date,
        }
      : {
          status: "investigating",
          date: new Date(),
        },
  });
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const { toast } = useToastAction();

  const onSubmit = ({ ...props }: InsertStatusReport) => {
    startTransition(async () => {
      try {
        if (defaultValues) {
          await api.statusReport.updateStatusReport.mutate({ ...props });
        } else {
          const { message, date, status, ...rest } = props;
          const statusReport = await api.statusReport.createStatusReport.mutate(
            {
              status,
              message,
              ...rest,
            },
          );
          // include update on creation
          if (statusReport?.id) {
            await api.statusReport.createStatusReportUpdate.mutate({
              message,
              date,
              status,
              statusReportId: statusReport.id,
            });
          }
        }
        if (nextUrl) {
          router.push(nextUrl);
        }
        router.refresh();
        toast("saved");
      } catch {
        toast("error");
      }
    });
  };

  function onValueChange(value: string) {
    // REMINDER: we are not merging the searchParams here
    // we are just setting the section to allow refreshing the page
    const params = new URLSearchParams();
    params.set("section", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Form {...form}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          form.handleSubmit(onSubmit)(e);
        }}
        className="grid w-full gap-6"
      >
        <General form={form} />
        <Tabs
          defaultValue={defaultSection}
          className="w-full"
          onValueChange={onValueChange}
        >
          <TabsList>
            {!defaultValues ? (
              <TabsTrigger value="update-message">Message</TabsTrigger>
            ) : null}
            <TabsTrigger value="connect">Connect</TabsTrigger>
          </TabsList>
          {!defaultValues ? (
            <TabsContent value="update-message">
              <SectionUpdateMessage form={form} />
            </TabsContent>
          ) : null}
          <TabsContent value="connect">
            <SectionConnect form={form} monitors={monitors} pages={pages} />
          </TabsContent>
        </Tabs>
        <SaveButton
          isPending={isPending}
          isDirty={form.formState.isDirty}
          onSubmit={form.handleSubmit(onSubmit)}
        />
      </form>
    </Form>
  );
}
