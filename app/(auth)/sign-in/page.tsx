'use client';

import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import InputField from "@/components/forms/InputField";

import FooterLinks from "@/components/forms/FooterLinks";
import SignUp from "../sign-up/page";

const SignIn = () => {

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({
    defaultValues: {
      email: '',
      password: '',

    },
    mode: 'onBlur',
  });

  const onSubmit = async (data: SignInFormData) => {
    try {
      console.log(data);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <h1 className='form-title'>Welcome Back</h1>

      <form onSubmit={handleSubmit(onSubmit)} className='space-y-5'>

        <InputField
          name='email'
          label='Email'
          placeholder='Jeremy@Clarkson.com'
          register={register}
          error={errors.email}
          validation={{ required: "Email is required", pattern: { value: /^\S+@\S+$/i, message: "Invalid email address" } }}
        />
        <InputField
          name='password'
          label='Password'
          placeholder='Enter a strong password'
          type="password"
          register={register}
          error={errors.password}
          validation={{ required: "Password is required", minLength: 8 }}
        />


        <Button
          type='submit'
          disabled={isSubmitting}
          className='yellow-btn w-full mt-5'
        >
          {isSubmitting ? 'Signing in' : 'Sign In'}
        </Button>

                <FooterLinks text="Don't have an account?" linkText="Sign up" href="/sign-up" />
      </form>
    </>
  );
};

export default SignIn;
