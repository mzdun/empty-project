// Copyright (c) @YEAR@ @APP_AUTHOR@
// This code is licensed under MIT license (see LICENSE for details)

#define NOMINMAX

#include <fmt/format.h>
#include <args/parser.hpp>
#include <filesystem>
#include "version.hh"

using namespace std::literals;

int tool(::args::args_view const& args) {
	fmt::print("Hello, {}!\n", "World");
	return 0;
}
