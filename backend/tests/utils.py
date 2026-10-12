class GreaterThanZero:
    def __eq__(self, other):
        return isinstance(other, (int, float)) and other > 0

    def __repr__(self):
        return "<GreaterThanZero>"


IS_POSITIVE = GreaterThanZero()
