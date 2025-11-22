

# Parallel arrays holding people and their birthdays. The same index in both lists
# refers to the same person. A dictionary would also work here, but the assignment
# specifically requests two separate 1D arrays, so we keep the data in parallel lists.
PEOPLE = [
    "Amelia Johnson",  # Index 0
    "Benjamin Carter",  # Index 1
    "Chloe Martinez",  # Index 2
    "Daniel Thompson",  # Index 3
    "Ella Nguyen",  # Index 4
    "Finn Robinson",  # Index 5
    "Grace Lee",  # Index 6
    "Henry Walker",  # Index 7
    "Isla Patel",  # Index 8
    "Jacob Rivera",  # Index 9
]

BIRTHDAYS = [
    "January 12",  # Birthday for PEOPLE[0]
    "February 08",  # Birthday for PEOPLE[1]
    "March 23",  # Birthday for PEOPLE[2]
    "April 19",  # Birthday for PEOPLE[3]
    "May 05",  # Birthday for PEOPLE[4]
    "June 17",  # Birthday for PEOPLE[5]
    "July 30",  # Birthday for PEOPLE[6]
    "August 11",  # Birthday for PEOPLE[7]
    "September 04",  # Birthday for PEOPLE[8]
    "October 28",  # Birthday for PEOPLE[9]
]
def main() -> None:
    """Drive the birthday lookup experience."""
    print("Welcome to the Birthday Lookup Booth!")  # Friendly greeting for the user.
    print(
        "Search by entering a name or even part of a name to reveal a birthday surprise.\n"
    )  # Explain how to use the program.

    query = input("Who are you looking for today? Enter a name fragment: ").strip()
    # Ask the user for a name (or part of it) and remove surrounding spaces.

    if not query:  # Guard against empty input so the rest of the code can rely on a value.
        print("You did not enter anything. Restart the program and try again with a name fragment.")
        return  # Stop the function early because we have nothing to search for.

    search_value = query.lower()  # Convert once so we do not repeat lower() inside the loop.
    found_match = False  # Track whether we showed at least one birthday.

    for position in range(len(PEOPLE)):  # Step through every slot in the parallel lists.
        if search_value in PEOPLE[position].lower():  # True when the user fragment appears.
            print(
                f"Party hats ready! {PEOPLE[position]} celebrates on {BIRTHDAYS[position]}."
            )  # Display the match immediately.
            found_match = True  # Mark that we found at least one person.

    if not found_match:  # When we never flipped the flag, nothing matched the fragment.
        print("No matches found. Double-check the spelling or try a different part of the name.")
        return  # Exit early because there is no data to display.

    print("Thanks for using the Birthday Lookup Booth!")  # Friendly goodbye once matches are shown.


if __name__ == "__main__":  # Allow the script to run when executed directly.
    main()  # Kick off the birthday lookup flow.


"""
Reflection (replace this block with your own 4-5 sentence reflection):
- Describe the approach you personally took to solve the problem.
- Mention any challenges you (the student) faced and how you addressed them.
- List any resources you consulted while working on the assignment.
- Keep the tone authentic and written in your own voice.
"""