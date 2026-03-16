import { useMutation } from "react-query";
import { useForm } from "react-hook-form";
import { Mail, MapPin } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import axios from "axios";
import { Link } from "react-router-dom";
import { submitContactForm } from "../api-client";
import { siteConfig } from "../config/siteConfig";
import { useToast } from "../hooks/use-toast";

type ContactFormValues = {
  name: string;
  email: string;
  phone?: string;
  message: string;
  privacyAccepted: boolean;
};

const ContactUs = () => {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormValues>({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      message: "",
      privacyAccepted: false,
    },
  });

  const mutation = useMutation(submitContactForm, {
    onSuccess: () => {
      toast({
        title: "Message sent",
        description:
          "Thank you for contacting us. We sent a confirmation to your email.",
      });
      reset();
    },
    onError: (error) => {
      const apiMessage =
        axios.isAxiosError(error) &&
        error.response?.data &&
        typeof error.response.data.message === "string"
          ? error.response.data.message
          : "We could not send your message right now. Please try again shortly.";

      toast({
        title: "Sending failed",
        description: apiMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: ContactFormValues) => {
    mutation.mutate(values);
  };

  const mapsQuery = encodeURIComponent(siteConfig.contact.address);
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  return (
    <section className="bg-[#f7f7f7] min-h-[70vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 bg-white border border-[#e7e9df] rounded-2xl p-6 sm:p-8 shadow-soft">
            <p className="uppercase tracking-[0.25em] text-[#ea836c] text-xs font-semibold mb-3">
              Palazzo Pinto B&B
            </p>
            <h1 className="text-3xl sm:text-4xl font-serif text-[#2b4463] leading-tight mb-4">
              Contact Us
            </h1>
            <p className="text-[#3f4d5f] leading-7 mb-8">
              We are happy to help with room availability, services, and any
              details you need before your stay in Brindisi.
            </p>

            <div className="space-y-5 text-[#2b4463]">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 mt-1 text-[#ea836c]" />
                <div>
                  <p className="font-semibold">Email</p>
                  <a
                    href={`mailto:${siteConfig.contact.email}`}
                    className="text-[#2b4463]/85 hover:text-[#ea836c] transition-colors"
                  >
                    {siteConfig.contact.email}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FaWhatsapp className="w-5 h-5 mt-1 text-[#ea836c]" />
                <div>
                  <p className="font-semibold">Phone</p>
                  <a
                    href={`https://wa.me/${siteConfig.contact.whatsapp}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#2b4463]/85 hover:text-[#ea836c] transition-colors"
                  >
                    {siteConfig.contact.phone}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 mt-1 text-[#ea836c]" />
                <div>
                  <p className="font-semibold">Address</p>
                  <a
                    href={mapsLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#2b4463]/85 hover:text-[#ea836c] transition-colors"
                  >
                    {siteConfig.contact.address}
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white border border-[#e7e9df] rounded-2xl p-6 sm:p-8 shadow-soft">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#2b4463] mb-1" htmlFor="contact-name">
                    Full Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    className="w-full rounded-lg border border-[#d9ddd0] px-3 py-2.5 text-[#2f3945] focus:outline-none focus:ring-2 focus:ring-[#aab09a]"
                    {...register("name", {
                      required: "Name is required",
                      minLength: { value: 2, message: "Name is too short" },
                    })}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#2b4463] mb-1" htmlFor="contact-email">
                    Email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    className="w-full rounded-lg border border-[#d9ddd0] px-3 py-2.5 text-[#2f3945] focus:outline-none focus:ring-2 focus:ring-[#aab09a]"
                    {...register("email", {
                      required: "Email is required",
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: "Enter a valid email",
                      },
                    })}
                  />
                  {errors.email && (
                    <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#2b4463] mb-1" htmlFor="contact-phone">
                  Phone (optional)
                </label>
                <input
                  id="contact-phone"
                  type="tel"
                  className="w-full rounded-lg border border-[#d9ddd0] px-3 py-2.5 text-[#2f3945] focus:outline-none focus:ring-2 focus:ring-[#aab09a]"
                  {...register("phone")}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#2b4463] mb-1" htmlFor="contact-message">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  rows={6}
                  className="w-full rounded-lg border border-[#d9ddd0] px-3 py-2.5 text-[#2f3945] focus:outline-none focus:ring-2 focus:ring-[#aab09a]"
                  {...register("message", {
                    required: "Message is required",
                    minLength: {
                      value: 10,
                      message: "Message must be at least 10 characters",
                    },
                  })}
                />
                {errors.message && (
                  <p className="text-sm text-red-600 mt-1">{errors.message.message}</p>
                )}
              </div>

              <div>
                <label className="flex items-start gap-3 text-sm text-[#2f3945]" htmlFor="contact-privacy">
                  <input
                    id="contact-privacy"
                    type="checkbox"
                    className="mt-1"
                    {...register("privacyAccepted", {
                      required: "You must accept the privacy policy",
                    })}
                  />
                  <span>
                    I agree to the processing of my personal data for this contact request. Read the{" "}
                    <Link
                      to="/privacy-cookie-policy"
                      className="underline font-medium text-[#2b4463] hover:text-[#1f334a]"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
                {errors.privacyAccepted && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.privacyAccepted.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={mutation.isLoading}
                className="inline-flex items-center justify-center rounded-lg bg-[#ea836c] text-white px-6 py-3 font-semibold hover:bg-[#db755f] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {mutation.isLoading ? "Sending..." : "Send Message"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactUs;
