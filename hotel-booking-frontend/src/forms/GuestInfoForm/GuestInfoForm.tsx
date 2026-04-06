import { forwardRef, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import useSearchContext from "../../hooks/useSearchContext";
import { useNavigate } from "react-router-dom";
import { User, Baby, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { getCancellationPolicyMessage } from "../../lib/cancellation-policy";

type Props = {
  hotelId: string;
  pricePerNight: number;
  minimumNights: number;
  maxAdults: number;
  maxChildren: number;
};

type GuestInfoFormData = {
  checkIn: Date | null;
  checkOut: Date | null;
  adultCount: number;
  childCount: number;
};

const DateRangeButton = forwardRef<
  HTMLButtonElement,
  {
    value?: string;
    onClick?: () => void;
  }
>(({ value, onClick }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-left text-sm text-gray-700 transition-colors hover:border-[#ea836c] focus:outline-none focus:ring-1 focus:ring-[#ea836c]"
  >
    <span className="flex items-center gap-2">
      <CalendarDays className="h-4 w-4 text-[#2b4463]" />
      <span>{value || "Check In  →  Check Out"}</span>
    </span>
  </button>
));

DateRangeButton.displayName = "DateRangeButton";

const GuestInfoForm = ({
  hotelId,
  pricePerNight,
  minimumNights,
  maxAdults,
  maxChildren,
}: Props) => {
  const search = useSearchContext();
  const navigate = useNavigate();
  const [usePortalCalendar, setUsePortalCalendar] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  useEffect(() => {
    const updateViewport = () => {
      setUsePortalCalendar(window.innerWidth < 900);
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);

    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  const {
    watch,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<GuestInfoFormData>({
    defaultValues: {
      checkIn: search.checkIn,
      checkOut: search.checkOut,
      adultCount: search.adultCount,
      childCount: search.childCount,
    },
  });

  const checkIn = watch("checkIn");
  const checkOut = watch("checkOut");
  const adultCount = watch("adultCount");
  const childCount = watch("childCount");
  const maxGuests = maxAdults + maxChildren;
  const allowedAdults = Math.max(1, Math.min(maxAdults, maxGuests - childCount));
  const allowedChildren = Math.max(0, Math.min(maxChildren, maxGuests - adultCount));

  useEffect(() => {
    if (adultCount > allowedAdults) {
      setValue("adultCount", allowedAdults, { shouldValidate: true });
    }
  }, [adultCount, allowedAdults, setValue]);

  useEffect(() => {
    if (childCount > allowedChildren) {
      setValue("childCount", allowedChildren, { shouldValidate: true });
    }
  }, [childCount, allowedChildren, setValue]);

  // Calculate number of nights
  let numberOfNights = 1;
  if (checkIn && checkOut) {
    const diff = checkOut.getTime() - checkIn.getTime();
    numberOfNights = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }
  const totalPrice = pricePerNight * numberOfNights;
  const isBelowMinimumStay = !!checkIn && !!checkOut && numberOfNights < minimumNights;
  const cancellationMessage = getCancellationPolicyMessage(checkIn);

  const minDate = new Date();
  minDate.setHours(0, 0, 0, 0);
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 1);

  const CalendarShell = ({ className, children }: { className?: string; children: ReactNode }) => (
    <div className={`${className || ""} room-booking-datepicker-shell`}>
      {usePortalCalendar && (
        <div className="room-booking-datepicker__mobile-topline">
          <span>Select check-in and check-out dates</span>
          <button
            type="button"
            className="room-booking-datepicker__action-primary"
            onClick={() => setIsCalendarOpen(false)}
          >
            Done
          </button>
        </div>
      )}
      {children}
    </div>
  );

  const onSubmit = (data: GuestInfoFormData) => {
    if (!data.checkIn || !data.checkOut) {
      return;
    }

    const normalizedCheckIn = new Date(data.checkIn);
    const normalizedCheckOut = new Date(data.checkOut);

    if (Number.isNaN(normalizedCheckIn.getTime()) || Number.isNaN(normalizedCheckOut.getTime())) {
      return;
    }

    if (normalizedCheckOut < normalizedCheckIn) {
      return;
    }

    const nights = Math.max(
      1,
      Math.ceil((normalizedCheckOut.getTime() - normalizedCheckIn.getTime()) / (1000 * 60 * 60 * 24))
    );

    if (nights < minimumNights) {
      return;
    }

    search.saveSearchValues(
      "",
      normalizedCheckIn,
      normalizedCheckOut,
      data.adultCount,
      data.childCount,
      hotelId
    );
    navigate(`/hotel/${hotelId}/booking`);
  };

  return (
    <div className="w-full">
      {/* Price badge */}
      <div className="text-right mb-3">
        <span className="text-sm text-gray-500">from </span>
        <span className="text-lg font-bold text-gray-900">€{pricePerNight}</span>
        <span className="text-sm text-gray-500"> / night</span>
        <p className="mt-1 text-xs text-gray-400">Minimum stay: {minimumNights} night{minimumNights === 1 ? "" : "s"}</p>
      </div>

      {/* Card */}
      <div className="border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
        {/* Check In/Out */}
        <div className="px-4 pt-4 pb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Check In/Out
          </p>
          <DatePicker
            required
            selected={checkIn}
            onChange={(dates) => {
              const [start, end] = dates as [Date | null, Date | null];
              setValue("checkIn", start, { shouldValidate: true });
              setValue("checkOut", end, { shouldValidate: true });

              if (start && end && usePortalCalendar) {
                setIsCalendarOpen(false);
              }
            }}
            open={isCalendarOpen}
            onInputClick={() => setIsCalendarOpen(true)}
            onClickOutside={() => setIsCalendarOpen(false)}
            selectsRange
            startDate={checkIn}
            endDate={checkOut}
            minDate={minDate}
            maxDate={maxDate}
            filterDate={(date) => date >= minDate}
            monthsShown={1}
            shouldCloseOnSelect={false}
            placeholderText="Check In  →  Check Out"
            dateFormat="dd/MM/yyyy"
            className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#ea836c] focus:border-[#ea836c]"
            wrapperClassName="w-full"
            customInput={<DateRangeButton />}
            calendarClassName="room-booking-datepicker"
            popperClassName="room-booking-datepicker-popper"
            popperPlacement="bottom-start"
            withPortal={usePortalCalendar}
            showPopperArrow={!usePortalCalendar}
            fixedHeight
            calendarContainer={CalendarShell}
            renderCustomHeader={({
              date,
              decreaseMonth,
              increaseMonth,
              prevMonthButtonDisabled,
              nextMonthButtonDisabled,
            }) => (
              <div className="room-booking-datepicker__header-bar">
                <button
                  type="button"
                  onClick={decreaseMonth}
                  disabled={prevMonthButtonDisabled}
                  className="room-booking-datepicker__nav-btn"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="room-booking-datepicker__month-label">
                  {date.toLocaleDateString("en-GB", {
                    month: "long",
                    year: "numeric",
                  })}
                </div>
                <button
                  type="button"
                  onClick={increaseMonth}
                  disabled={nextMonthButtonDisabled}
                  className="room-booking-datepicker__nav-btn"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          />
        </div>

        <div className="border-t border-gray-100 mx-4" />

        {/* Guests */}
        <div className="px-4 pt-3 pb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Guests{" "}
            <span className="font-normal normal-case text-gray-400">
              {adultCount + childCount} total
            </span>
          </p>

          <div className="grid grid-cols-2 gap-3">
            {/* Adults */}
            <div>
              <label className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                <User className="w-3 h-3" /> Adults (18+)
              </label>
              <input
                type="number"
                min={1}
                max={allowedAdults}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-center font-semibold focus:outline-none focus:ring-1 focus:ring-[#ea836c] focus:border-[#ea836c]"
                {...register("adultCount", {
                  required: "Required",
                  min: { value: 1, message: "At least 1 adult" },
                  max: {
                    value: maxAdults,
                    message: `Maximum ${maxAdults} adult${maxAdults === 1 ? "" : "s"}`,
                  },
                  valueAsNumber: true,
                })}
              />
              {errors.adultCount && (
                <p className="text-red-500 text-xs mt-0.5">{errors.adultCount.message}</p>
              )}
            </div>

            {/* Children */}
            <div>
              <label className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                <Baby className="w-3 h-3" /> Children (4–18)
              </label>
              <input
                type="number"
                min={0}
                max={allowedChildren}
                disabled={allowedChildren === 0}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-center font-semibold focus:outline-none focus:ring-1 focus:ring-[#ea836c] focus:border-[#ea836c]"
                {...register("childCount", {
                  min: { value: 0, message: "Cannot be negative" },
                  max: {
                    value: maxChildren,
                    message: `Maximum ${maxChildren} child${maxChildren === 1 ? "" : "ren"}`,
                  },
                  valueAsNumber: true,
                })}
              />
              {errors.childCount && (
                <p className="text-red-500 text-xs mt-0.5">{errors.childCount.message}</p>
              )}
              {!errors.childCount && allowedChildren === 0 && (
                <p className="text-gray-400 text-xs mt-0.5">No child places left for this selection.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Nights + total */}
      {checkIn && checkOut && (
        <div className="mt-3 flex items-center justify-between px-1 text-sm text-gray-600">
          <span>
            €{pricePerNight} × {numberOfNights} night{numberOfNights !== 1 ? "s" : ""}
          </span>
          <span className="font-bold text-gray-900">€{totalPrice} total</span>
        </div>
      )}

      {checkOut && checkIn && checkOut < checkIn && (
        <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          Check-out cannot be earlier than check-in.
        </p>
      )}

      {isBelowMinimumStay && (
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Minimum stay for this room is {minimumNights} night{minimumNights === 1 ? "" : "s"}.
        </p>
      )}

      {/* CTA */}
      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 w-full">
        <button
          type="submit"
          disabled={!checkIn || !checkOut || isBelowMinimumStay}
          className="block w-full bg-[#ea836c] hover:bg-[#d9725d] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg text-sm tracking-wide uppercase transition-colors"
        >
          Check Availability
        </button>
      </form>

      <div className="mt-3 text-center text-xs text-gray-400 space-y-1">
        <p>{cancellationMessage}</p>
        <p>No booking fees</p>
        <p>City Tax included (€2.50 per person, per night)</p>
      </div>
    </div>
  );
};

export default GuestInfoForm;
