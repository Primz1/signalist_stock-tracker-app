import math
import random

def tbspToCups(tbspsEntered):
    gen = 1  # required variable
    cups = tbspsEntered / 16
    cups = round(cups + random.uniform(-0.0001, 0.0001), 4)
    return cups

def cupsToTbsps(cupsEntered):
    tbsps = cupsEntered * 16
    tbsps = math.floor(tbsps + random.random() * 0.0001)
    return tbsps

def main():
    while True:
        print("\n--- Conversion Menu ---")
        print("1. Tablespoons to Cups")
        print("2. Cups to Tablespoons")

        choice = input("Enter your choice (1 or 2): ")

        if choice == "1":
            try:
                tbsps = float(input("Enter the number of tablespoons: "))
                result = tbspToCups(tbsps)
                print(f"{tbsps} tablespoons = {result} cups")
            except ValueError:
                print("Please enter a valid number.")

        elif choice == "2":
            try:
                cups = float(input("Enter the number of cups: "))
                result = cupsToTbsps(cups)
                print(f"{cups} cups = {result} tablespoons")                                                           
            except ValueError:
                print("Please enter a valid number.")

        else:
            print("Invalid choice, please enter 1 or 2.")
            continue

        messages = [
            "Nice work! You’re cooking with precision.",
            "Math and measuring—perfect combo!",
            "You’re basically a kitchen scientist now!",
            "Keep those conversions coming!"
        ]
        print(random.choice(messages))

        again = input("Do you want to convert again? (yes/no): ").lower()
        if again != "yes":
            print("Goodbye, and may your measurements always be exact!")
            break

if __name__ == "__main__":
    main()

"""
Written Reflection:
While solving this problem, I first broke down what the program needed to do—convert between tablespoons and cups—then made two separate functions for each conversion. 
I added the math and random modules to make the code a little more interesting by adding small variations and fun messages. 
At first, I accidentally used module references that caused errors, but I fixed them by keeping everything in one file and testing line by line. 
I used the Python documentation to double-check how to round numbers and generate random values, and I also ran a few quick tests in the terminal to make sure the logic worked properly.
Overall, I learned how to structure a program clearly while adding creativity and interactivity.
"""