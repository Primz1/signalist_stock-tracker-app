# Python
total = 0.0
for i in range(1, 11):
    while True:
        try:
            n = float(input(f"Enter number #{i}: "))
            break
        except ValueError:
            print("Invalid number; please enter a valid numeric value.")
    total += n

print("Total of the 10 numbers is:", total)